// all imports
const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const jwt = require("jsonwebtoken");
require("dotenv").config();

// define port and app
const port = process.env.PORT || 5000;
const app = express();

// middlewares
app.use(cors());
app.use(express.json());

// mongodb server connection
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.afwac63.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});

// default api
app.get("/", (req, res) => {
  res.send("Products resale server running!");
});

// api gateway function
async function run() {
  const usersCollection = client.db("productsResale").collection("users");
  const categoriesCollection = client
    .db("productsResale")
    .collection("categories");

  try {
    // check if a user exists
    app.get("/checkUser", async (req, res) => {
      const userEmail = req.query.email;
      const query = { email: userEmail };
      const result = await usersCollection.findOne(query);
      if (result) {
        res.send({
          status: true,
          message: "User already exists!",
        });
      } else {
        res.send({
          status: false,
          message: "User doesn't exist!",
        });
      }
    });

    // create a user
    app.post("/user", async (req, res) => {
      const user = req.body;
      const result = await usersCollection.insertOne(user);
      if (result.acknowledged) {
        res.send({
          status: true,
          message: "Your account has been created",
        });
      } else {
        res.send({
          status: false,
          message: "An error occurred! Please register again!",
        });
      }
    });

    // get a user
    app.get("/user", async (req, res) => {
      const userEmail = req.query.email;
      const query = { email: userEmail };
      const result = await usersCollection.findOne(query);
      res.send({
        status: true,
        data: result,
      });
    });

    // get users based on buyer and seller
    app.get("/users", async (req, res) => {
      const type = req.query.type;
      const query = { userType: type };
      const result = await usersCollection.find(query).toArray();
      res.send({
        status: true,
        allData: result,
      });
    });

    // get brand categories
    app.get("/categories", async (req, res) => {
      const query = {};
      const result = await categoriesCollection.find(query).toArray();
      res.send({
        status: true,
        data: result,
      });
    });
  } finally {
  }
}

run().catch((error) => console.error(error));

app.listen(port, () => {
  console.log(`App running on port ${port}`);
});
