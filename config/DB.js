const mongoose = require("mongoose");
require("dotenv").config();

const connectDB = async () => {
    try {
        // This function returns a promise, so we wait for it to complete
        await mongoose.connect(process.env.CONNECTION_STRING);
        console.log("mongodb atlas connected.");
    } catch (e) {
        console.log("unable to connect to the database.");
        // console.log(e);
    }
}

module.exports = connectDB;