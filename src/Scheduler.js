const DeleteController = require('./DeleteController');

class Scheduler {
    constructor() {
        this.delCtrl = new DeleteController();
    }

    async run() {
        try {
            await this.delCtrl.deleteExpiredOrders();
            console.log("Successfully deleted expired orders.");
        } catch (error) {
            console.error("Scheduler encountered an error:", error);
            process.exit(1);
        }
    }
}

module.exports = Scheduler;
