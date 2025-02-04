const express = require("express");
const app = express();
const cors = require("cors");
const jwt = require("jsonwebtoken");
const axios = require("axios");
require("dotenv").config();
// This is your test secret API key.
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
// email
const formData = require("form-data");
const Mailgun = require("mailgun.js");
const mailgun = new Mailgun(formData);
const mg = mailgun.client({
  username: "api",
  key: process.env.MAIL_GUN_API_KEY,
});
const port = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
// 000000000

// Store ID: bisto679f86b94ee17
// Store Password (API/Secret Key): bisto679f86b94ee17@ssl

// Merchant Panel URL: https://sandbox.sslcommerz.com/manage/ (Credential as you inputted in the time of registration)

// Store name: testbistolkh4
// Registered URL: www.bistoboss.com
// Session API to generate transaction: https://sandbox.sslcommerz.com/gwprocess/v3/api.php
// Validation API: https://sandbox.sslcommerz.com/validator/api/validationserverAPI.php?wsdl
// Validation API (Web Service) name: https://sandbox.sslcommerz.com/validator/api/validationserverAPI.php

// You may check our plugins available for multiple carts and libraries: https://github.com/sslcommerz

// 00000000000000000
// middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded());
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.wivsw.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;
// step-1 payment initiate

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

// MongoDB Connection and API Routes
async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();
    const menuCollection = client.db("bistroDb").collection("menu");
    const reviewsCollection = client.db("bistroDb").collection("revius");
    const cartCollection = client.db("bistroDb").collection("carts");
    const userCollection = client.db("bistroDb").collection("users");
    const paymentCollection = client.db("bistroDb").collection("payments");

    // middlewares token
    const verifyToken = (req, res, next) => {
      // console.log("inside verify token", req.headers.authorization);
      if (!req.headers.authorization) {
        return res.status(401).send({ message: "unauthorized access" });
      }
      const token = req.headers.authorization.split(" ")[1];
      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
          return res.status(401).send({ message: "unauthorized access" });
        }
        req.decoded = decoded;
        next();
      });
    };
    // use veryfy admin after veryfyToken

    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await userCollection.findOne(query);
      const isAdmin = user?.role === "admin";
      if (!isAdmin) {
        return res.status(403).send({ message: "forbidden access" });
      }
      next();
    };

    // jwt related api
    app.post("/jwt", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "365d",
      });
      res.send({ token });
    });

    // menuCollection data lode
    app.get("/menu", async (req, res) => {
      const result = await menuCollection.find().toArray();
      res.send(result);
    });
    app.post("/menu", verifyToken, verifyAdmin, async (req, res) => {
      const item = req.body;
      const result = await menuCollection.insertOne(item);
      res.send(result);
    });
    // update
    app.get("/menu/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await menuCollection.findOne(query);
      res.send(result);
    });
    app.patch("/menu/:id", async (req, res) => {
      const item = req.body;
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          name: item.name,
          category: item.category,
          price: item.price,
          recipe: item.recipe,
          image: item.image,
        },
      };
      const result = await menuCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });

    app.delete("/menu/:id", verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await menuCollection.deleteOne(query);
      res.send(result);
    });
    // reviewsCollection loding
    app.get("/reviews", async (req, res) => {
      const result = await reviewsCollection.find().toArray();
      res.send(result);
    });

    // carts collection
    app.post("/carts", async (req, res) => {
      const cartItem = req.body;
      const result = await cartCollection.insertOne(cartItem);
      res.send(result);
    });

    app.get("/carts", async (req, res) => {
      const email = req.query.email;
      const query = { email: email };
      const result = await cartCollection.find(query).toArray();
      res.send(result);
    });

    app.delete("/carts/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await cartCollection.deleteOne(query);
      res.send(result);
    });

    // users related api

    app.post("/users", async (req, res) => {
      const user = req.body;
      // insert email if user doesent exists :
      const query = { email: user.email };
      const existingUser = await userCollection.findOne(query);
      if (existingUser) {
        return res.send({ message: "user already exists", insertedId: null });
      }
      const result = await userCollection.insertOne(user);
      res.send(result);
    });

    app.get("/users/admin/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      if (email !== req.decoded.email) {
        return res.status(403).send({ message: " forbidden  access" });
      }
      const query = { email: email };
      const user = await userCollection.findOne(query);
      let admin = false;
      if (user) {
        admin = user?.role === "admin";
      }
      res.send({ admin });
    });

    app.get("/users", verifyToken, verifyAdmin, async (req, res) => {
      const result = await userCollection.find().toArray();
      res.send(result);
    });
    app.patch(
      "/users/admin/:id",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        const id = req.params.id;
        const filter = { _id: new ObjectId(id) };
        const updatedDoc = {
          $set: {
            role: "admin",
          },
        };
        const related = await userCollection.updateOne(filter, updatedDoc);
        res.send(related);
      }
    );
    app.delete("/users/:id", verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const related = await userCollection.deleteOne(query);
      res.send(related);
    });
    //payment intent
    app.post("/create-payment-intent", async (req, res) => {
      const { price } = req.body;
      const amount = Math.round(price * 100);
      // const amount = parseInt(price * 100);
      // console.log("Price:", price, "Amount in cents:", amount);
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"],
      });
      res.send({ clientSecret: paymentIntent.client_secret });
    });
    // payment api
    app.post("/payments", async (req, res) => {
      const payment = req.body;
      const paymentResult = await paymentCollection.insertOne(payment);
      // delete each item from the cart
      console.log("payment info", payment);
      const query = {
        _id: {
          $in: payment.cartIds.map((id) => new ObjectId(id)),
        },
      };
      const deleteResult = await cartCollection.deleteMany(query);
      // send user email about payment confirmation
      mg.messages
        .create(process.env.MAIL_SENDING_DOMAIN, {
          from: "Excited User <mailgun@sandbox132355138f214066a85a97939bb3f389.mailgun.org>",
          to: ["test@example.com"],
          subject: "Bistro Boss Order Confirmation",
          text: "Testing some Mailgun awesomeness!",
          html: `<div>
          <h1>Tthank you for your awesomeness!</h1>
         <h4>Tthank you for your awesomeness!</h4>
<p>we would like </p>
          </div> `,
        })
        .then((msg) => console.log(msg)) // logs response data
        .catch((err) => console.log(err)); // logs any error
      res.send({ paymentResult, deleteResult });
    });
    // payment api

    app.get("/payments/:email", verifyToken, async (req, res) => {
      const query = { email: req.params.email };
      if (req.params.email !== req.decoded.email) {
        return res.status(404).send({ message: "forbidden access" });
      }

      const result = await paymentCollection.find(query).toArray();
      res.send(result);
    });
    // ssl payments
    app.post("/create-ssl-payment", async (req, res) => {
      const payment = req.body;
      const trxid = new ObjectId().toString();
      payment.transactionId = trxid;
      // console.log("payment info", payment);
      const initiate = {
        store_id: "bisto679f86b94ee17",
        store_passwd: "bisto679f86b94ee17@ssl",
        total_amount: payment.price,
        currency: "BDT",
        tran_id: trxid,
        success_url: "http://localhost:5000/success-payment",
        fail_url: "http://localhost:5173/fail",
        cancel_url: "http://localhost:5173/cancel",
        ipn_url: "http://localhost:5000/ipn-success-payment",
        shipping_method: "Courier",
        product_name: "Computer.",
        product_category: "Electronic",
        product_profile: "general",
        cus_name: "Customer Name",
        cus_email: `${payment.email}`,
        cus_add1: "Dhaka",
        cus_add2: "Dhaka",
        cus_city: "Dhaka",
        cus_state: "Dhaka",
        cus_postcode: "1000",
        cus_country: "Bangladesh",
        cus_phone: "01711111111",
        cus_fax: "01711111111",
        ship_name: "Customer Name",
        ship_add1: "Dhaka",
        ship_add2: "Dhaka",
        ship_city: "Dhaka",
        ship_state: "Dhaka",
        ship_postcode: 1000,
        ship_country: "Bangladesh",
      };
      const iniResponse = await axios({
        url: "https://sandbox.sslcommerz.com/gwprocess/v4/api.php",
        method: "POST",
        data: initiate,
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      });
      const saveData = await paymentCollection.insertOne(payment);
      const getewayUrl = iniResponse?.data?.GatewayPageURL;

      // console.log(getewayUrl, "iniResponser");
      res.send({ getewayUrl });
    });
    // success-payment
    app.post("/success-payment", async (req, res) => {
      const paymentSuccess = req.body;
      console.log(paymentSuccess, "paymentSuccess");
      // console.log("paymentSuccess info", paymentSuccess);
      const isValidPayment = await axios.get(
        `https://sandbox.sslcommerz.com/validator/api/validationserverAPI.php?val_id=${paymentSuccess.val_id}&store_id=bisto679f86b94ee17&store_passwd= bisto679f86b94ee17@ssl&format=json`
      );
      console.log(isValidPayment, "isValidPayment");
    });
    // send user email about payment confirmation

    // stats or analytice
    app.get("/admin-stats", verifyToken, verifyAdmin, async (req, res) => {
      const users = await userCollection.estimatedDocumentCount();
      const menuItems = await menuCollection.estimatedDocumentCount();
      const orders = await paymentCollection.estimatedDocumentCount();

      // this is not the dest way
      // const payments = await paymentCollection.find().toArray();
      // const revenue = payments.reduce(
      //   (total, payment) => total + payment.price,
      //   0
      // );

      const result = await paymentCollection
        .aggregate([
          {
            $group: {
              _id: null,
              totalRevenue: {
                $sum: "$price",
              },
            },
          },
        ])
        .toArray();

      const revenue = result.length > 0 ? result[0].totalRevenue : 0;

      res.send({
        users,
        menuItems,
        orders,
        revenue,
      });
    });
    // using aggregate pipeline
    app.get("/order-stats", verifyToken, verifyAdmin, async (req, res) => {
      const result = await paymentCollection
        .aggregate([
          {
            $unwind: "$menuItemIds",
          },
          {
            $lookup: {
              from: "menu",
              localField: "menuItemIds",
              foreignField: "_id",
              as: "menuItems",
            },
          },
          {
            $unwind: "$menuItems",
          },
          {
            $group: {
              _id: "$menuItems.category",
              quantity: { $sum: 1 },
              revenue: { $sum: "$menuItems.price" },
            },
          },
          {
            $project: {
              _id: 0,
              category: "$_id",
              quantity: "$quantity",
              revenue: "$revenue",
            },
          },
        ])
        .toArray();
      res.send(result);
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("server is run");
});
app.listen(port, () => {
  // console.log(`Bistro boss is sitting on port ${port}`);
});
//  -----------
// naming convention
//  -------------
