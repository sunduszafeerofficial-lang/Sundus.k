require("dotenv").config();

const express = require("express");
const Razorpay = require("razorpay");
const nodemailer = require("nodemailer");
const twilio = require("twilio");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 5000;

/* ================= MIDDLEWARE ================= */

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/image", express.static(path.join(__dirname, "image")));

/* ================= FILE STORAGE ================= */

const ordersFile = path.join(__dirname, "orders.json");

const getOrders = () =>
  fs.existsSync(ordersFile)
    ? JSON.parse(fs.readFileSync(ordersFile))
    : [];

const saveOrders = (orders) =>
  fs.writeFileSync(ordersFile, JSON.stringify(orders, null, 2));

/* ================= RAZORPAY ================= */

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

/* ================= EMAIL SETUP ================= */

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.CONTACT_EMAIL,
    pass: process.env.EMAIL_PASSWORD,
  },
});

transporter.verify((error) => {
  if (error) {
    console.error("❌ Email config error:", error);
  } else {
    console.log("✅ Email service ready");
  }
});

/* ================= WHATSAPP ================= */

const client = new twilio(
  process.env.TWILIO_SID,
  process.env.TWILIO_AUTH
);

/* ================= EMAIL FUNCTIONS ================= */

function sendCustomerEmail(order) {
  transporter.sendMail(
    {
      from: process.env.CONTACT_EMAIL,
      to: order.email,
      subject: `Order Confirmation - ${order.book}`,
      html: `
        <h2>Thank you ${order.name}</h2>
        <p>Order ID: ${order.id}</p>
        <p>Book: ${order.book}</p>
        <p>Amount: ₹${order.price}</p>
      `,
    },
    (err) => {
      if (err) console.error("❌ Customer email error:", err);
      else console.log("✅ Customer email sent");
    }
  );
}

function sendOrderEmail(order) {
  transporter.sendMail(
    {
      from: process.env.CONTACT_EMAIL,
      to: process.env.CONTACT_EMAIL,
      subject: `New Order - ${order.book}`,
      html: `
        <h2>New Order Received</h2>
        <p>ID: ${order.id}</p>
        <p>Name: ${order.name}</p>
        <p>Phone: ${order.phone}</p>
        <p>Payment: ${order.payment}</p>
        <p>Amount: ₹${order.price}</p>
      `,
    },
    (err) => {
      if (err) console.error("❌ Admin email error:", err);
      else console.log("✅ Admin email sent");
    }
  );
}

/* ================= COD ORDER ================= */

app.post("/order-cod", (req, res) => {
  try {
    const { name, phone, email, address, book, price } = req.body;

    if (!name || !phone || !address || !book) {
      return res.status(400).json({ success: false, message: "Missing fields" });
    }

    const order = {
      id: Date.now(),
      name,
      phone,
      email,
      address,
      book,
      payment: "COD",
      price: price || 299,
      status: "Pending",
      createdAt: new Date().toISOString(),
    };

    const orders = getOrders();
    orders.push(order);
    saveOrders(orders);

    sendOrderEmail(order);
    if (email) sendCustomerEmail(order);

    res.json({ success: true, message: "Order placed!", orderId: order.id });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

/* ================= VIEW ORDERS ================= */

app.get("/orders", (req, res) => {
  res.json(getOrders());
});

/* ================= HEALTH CHECK ================= */

app.get("/", (req, res) => {
  res.send("Server is running 🚀");
});

/* ================= START SERVER ================= */

app.listen(PORT, () => {
  console.log("========================================");
  console.log("🔥 SERVER RUNNING ON PORT:", PORT);
  console.log("========================================");
});
