const mysql = require('mysql2/promise');
const fs = require('fs');

class DBPool {
    constructor() {
        this.pool = mysql.createPool({
            host: process.env.DB_HOST,
            port: Number(process.env.DB_PORT),
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME,
            ssl: {
                ca: fs.readFileSync('certs/ca.pem'),
            },
            timezone: '+07:00',
            waitForConnections: true,
            connectionLimit: 10,
            queueLimit: 0
        });
    }

    async getConnection() {
        return await this.pool.getConnection();
    }

    async query(query, params) {
        const connection = await this.getConnection();
        try {
            const [results] = await connection.execute(query, params);
            return results;
        } finally {
            connection.release();
        }
    }

    async closePool() {
        await this.pool.end();
    }
}

module.exports = DBPool;
