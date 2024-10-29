const DBPool = require('./DBPool');
const AWS_S3 = require('./AWS_S3');

class DeleteController {
  constructor() {
    this.db = new DBPool();
    this.awsS3 = new AWS_S3();
  }

  async getNextMsgId(connection) {
    const [[{ Msg_id }]] = await connection.execute(
      'SELECT Msg_id FROM NOTIFIED_MSG ORDER BY Msg_id DESC LIMIT 1'
    );

    if (!Msg_id) {
      return 'msg00001';
    }

    const lastNumber = parseInt(Msg_id.substring(3), 10);
    const nextNumber = lastNumber + 1;
    return `msg${nextNumber.toString().padStart(5, '0')}`;
  }

  async deleteExpiredOrders() {
    let connection;

    try {
      connection = await this.db.getConnection();
      await connection.beginTransaction();

      const expiredOrders = await this.getExpiredOrders(connection);

      if (expiredOrders.length === 0) {
        await connection.commit();
        console.log('Nothing is expired');
        return;
      }
      
      for (const order of expiredOrders) {
        const { Order_id, Email, Payment_status, Receipt_pic } = order;
        await this.deleteOrder(connection, Order_id, Email, Payment_status, Receipt_pic);
      }

      await connection.commit();
    } catch (error) {
      if (connection) {
        await connection.rollback();
      }
      console.error('Error in deleteExpiredOrders:', error);
      throw error;
    } finally {
      if (connection) {
        connection.release();
      }
      await this.db.closePool();
    }
  }

  async getExpiredOrders(connection) {
    const [expiredOrders] = await connection.execute(
      `SELECT Order_id, Email, Payment_status, Receipt_pic  FROM ORDERS 
      WHERE (payment_deadline < NOW() AND Payment_status = ?) or Payment_status = ?`,
      ['N', 'C']
    );
    return expiredOrders;
  }

  async deleteOrder(connection, orderId, email, paymentStatus, receiptPic) {
    const productIds = await this.getProductIds(connection, orderId);

    // Delete product folders from S3
    for (const { product_id } of productIds) {
      await this.awsS3.deleteFolder(product_id);
    }

    // If Payment_status is 'C', delete the receipt image
    if (paymentStatus === 'C' && receiptPic) {
      try {
        const url = new URL(receiptPic);
        const key = url.pathname.substring(1); 

        await this.awsS3.deleteFile(key);
        console.log(`Successfully deleted receipt image: ${key} from S3`);
      } catch (error) {
        console.error(`Error deleting receipt image for order ${orderId}:`, error);
      }
    }

    const msgId = await this.getNextMsgId(connection);
    let msg;

    if (paymentStatus === 'N') {
      msg = `Your order with ID ${orderId} has been canceled due to non-payment before the deadline.`;
    } else {
      msg = `Your order with ID ${orderId} has been canceled due to issues with the payment evidence.`;
    }
    await this.createNotification(connection, msgId, msg, email);

    await this.deleteOrderData(connection, orderId);
  }

  extractS3KeyFromUrl(url) {
    try {
      const urlObj = new URL(url);
      // Assuming the S3 URL format is consistent
      return urlObj.pathname.substring(1); 
    } catch (error) {
      console.error('Invalid URL:', url, error);
      return null;
    }
  }

  async getProductIds(connection, orderId) {
    const [products] = await connection.execute(
      'SELECT product_id FROM PRODUCT WHERE Order_id = ?',
      [orderId]
    );
    return products;
  }

  async createNotification(connection, msgId, msg, email) {
    await connection.execute(
      'INSERT INTO NOTIFIED_MSG (Msg_id, Msg, Notified_date, Is_read, Email) VALUES (?, ?, NOW(), 0, ?)',
      [msgId, msg, email]
    );
  }

  async deleteOrderData(connection, orderId) {
    await connection.execute('DELETE FROM PRODUCT WHERE Order_id = ?', [orderId]);
    await connection.execute('DELETE FROM STATUS WHERE Order_id = ?', [orderId]);
    await connection.execute('DELETE FROM ORDERS WHERE Order_id = ?', [orderId]);
  }
}

module.exports = DeleteController;
