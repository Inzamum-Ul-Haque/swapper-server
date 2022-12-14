// all imports
const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const jwt = require("jsonwebtoken");
require("dotenv").config();
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

// define port and app
const port = process.env.PORT || 5000;
const app = express();

// middlewares
app.use(cors());
app.use(express.json());

function verifyJWT(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).send({ message: "unauthorized access!" });
  }

  const token = authHeader.split(" ")[1];

  jwt.verify(token, process.env.ACCESS_TOKEN, function (error, decoded) {
    if (error) {
      return res.status(403).send({ message: "forbidden Access!" });
    }
    req.decoded = decoded;
    next();
  });
}

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
  const productsCollection = client.db("productsResale").collection("products");
  const bookingsCollection = client.db("productsResale").collection("bookings");
  const wishListCollection = client
    .db("productsResale")
    .collection("wishlists");
  const advertiseCollection = client
    .db("productsResale")
    .collection("advertise");
  const categoriesCollection = client
    .db("productsResale")
    .collection("categories");

  try {
    // verify admin access
    const verifyAdmin = async (req, res, next) => {
      const decodedEmail = req.decoded.email;
      const query = { email: decodedEmail };
      const user = await usersCollection.findOne(query);
      if (user?.userType !== "Admin") {
        return res.status(403).send({ message: "forbidden access" });
      }
      next();
    };

    // verify buyer access
    const verifyBuyer = async (req, res, next) => {
      const decodedEmail = req.decoded.email;
      const query = { email: decodedEmail };
      const user = await usersCollection.findOne(query);
      if (user?.userType !== "Buyer") {
        return res.status(403).send({ message: "forbidden access" });
      }
      next();
    };

    // verify seller access
    const verifySeller = async (req, res, next) => {
      const decodedEmail = req.decoded.email;
      const query = { email: decodedEmail };
      const user = await usersCollection.findOne(query);
      if (user?.userType !== "Seller") {
        return res.status(403).send({ message: "forbidden access" });
      }
      next();
    };

    // issue jwt token
    app.get("/jwt", async (req, res) => {
      const email = req.query.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      if (user) {
        const token = jwt.sign({ email }, process.env.ACCESS_TOKEN, {
          expiresIn: "3h",
        });
        return res.send({ accessToken: token });
      }
      res.status(403).send({ accessToken: null });
    });

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
    app.get("/users", verifyJWT, verifyAdmin, async (req, res) => {
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

    // add a product
    app.post("/product", async (req, res) => {
      const productInfo = req.body;
      const result = await productsCollection.insertOne(productInfo);
      if (result.acknowledged) {
        res.send({
          status: true,
          message: "Product has been successfully added!",
        });
      } else {
        res.send({
          status: false,
          message: "An error occurred! Please try again!",
        });
      }
    });

    // delete a user
    app.delete("/user", async (req, res) => {
      const userEmail = req.query.email;
      const query = { email: userEmail };
      const result = await usersCollection.deleteOne(query);
      if (result.deletedCount > 0) {
        res.send({
          status: true,
          message: "User deleted successfully!",
        });
      } else {
        res.send({
          status: false,
          message: "An error occurred! Please try again!",
        });
      }
    });

    // verify a user
    app.patch("/user", verifyJWT, verifySeller, async (req, res) => {
      const userEmail = req.query.email;
      const query = { email: userEmail };
      const updatedDoc = {
        $set: {
          verified: true,
        },
      };
      const result = await usersCollection.updateOne(query, updatedDoc);
      if (result.acknowledged) {
        res.send({
          status: true,
          message: "User verified successfully!",
        });
      } else {
        res.send({
          status: false,
          message: "An error occurred! Please try again!",
        });
      }
    });

    // show products added by a user
    app.get("/products", async (req, res) => {
      const userEmail = req.query.email;
      const query = { sellerEmail: userEmail };
      const result = await productsCollection.find(query).toArray();
      res.send({
        status: true,
        data: result,
      });
    });

    // show products based on categories
    app.get("/category/:id", async (req, res) => {
      // first get the category from categories collection
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const result = await categoriesCollection.findOne(query);
      const categoryName = result.name;

      // get the products from that category
      const filter = { productCategory: categoryName };
      const products = await productsCollection.find(filter).toArray();
      res.send({
        status: true,
        data: products,
        category: categoryName,
      });
    });

    // delete a product
    app.delete("/product/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const result = await productsCollection.deleteOne(query);
      if (result.acknowledged) {
        res.send({
          status: true,
          message: "Product deleted successfully!",
        });
      } else {
        res.send({
          status: false,
          message: "An error occurred! Please try again!",
        });
      }
    });

    // book a order
    app.post("/booking", async (req, res) => {
      const booking = req.body;
      const result = await bookingsCollection.insertOne(booking);
      if (result.acknowledged) {
        res.send({
          status: true,
          message: "Order placed successfully!",
        });
      } else {
        res.send({
          status: false,
          message: "An error occurred! Please try again!",
        });
      }
    });

    // advertise an item
    app.post("/advertise", async (req, res) => {
      const advertiseItem = req.body;
      // check before adding if this item exists in the advertise collection
      const id = advertiseItem.productId;
      const query = { productId: id };
      const exists = await advertiseCollection.findOne(query);
      if (exists) {
        res.send({
          status: false,
          message: "This item is already advertised!",
        });
      } else {
        const result = await advertiseCollection.insertOne(advertiseItem);
        if (result.acknowledged) {
          res.send({
            status: true,
            message: "Item has been advertised",
          });
        } else {
          res.send({
            status: false,
            message: "An error occurred! Please try again!",
          });
        }
      }
    });

    // get advertised items from db
    app.get("/advertise", async (req, res) => {
      const query = {};
      const result = await advertiseCollection
        .find(query)
        .sort({ _id: -1 })
        .limit(4)
        .toArray();
      res.send({
        status: true,
        data: result,
      });
    });

    // get orders ordered by a user
    app.get("/orders", verifyJWT, verifyBuyer, async (req, res) => {
      const userEmail = req.query.email;
      const query = { buyerEmail: userEmail };
      const result = await bookingsCollection.find(query).toArray();
      res.send({
        status: true,
        data: result,
      });
    });

    // add item to wishlist
    app.post("/addToWishlist", async (req, res) => {
      const wishListItem = req.body;

      // check if the item exists on wishlist collection
      const id = wishListItem.productId;
      const query = { productId: id };
      const exists = await wishListCollection.findOne(query);
      if (exists) {
        res.send({
          status: false,
          message: "This item is already wishlisted!",
        });
      } else {
        const result = await wishListCollection.insertOne(wishListItem);
        if (result.acknowledged) {
          res.send({
            status: true,
            message: "Item has been wishlisted",
          });
        } else {
          res.send({
            status: false,
            message: "An error occurred! Please try again!",
          });
        }
      }
    });

    // get items from wishlist
    app.get("/wishlist", async (req, res) => {
      const userEmail = req.query.email;
      const query = { buyerEmail: userEmail };
      const result = await wishListCollection.find(query).toArray();
      res.send({
        status: true,
        data: result,
      });
    });

    // delete item from wishlist
    app.delete("/wishlist", async (req, res) => {
      const userEmail = req.query.email;
      const productId = req.query.productId;

      const query = { buyerEmail: userEmail, productId: productId };
      const result = await wishListCollection.deleteOne(query);
      if (result.acknowledged) {
        res.send({
          status: true,
          message: "Item have been deleted from wishlist",
        });
      } else {
        res.send({
          status: false,
          message: "An error occurred! Please try again!",
        });
      }
    });

    // payment intent
    app.post("/create-payment-intent", async (req, res) => {
      const booking = req.body;
      const price = booking.productResalePrice;
      const amount = price * 100;

      const paymentIntent = await stripe.paymentIntents.create({
        currency: "usd",
        amount: amount,
        payment_method_types: ["card"],
      });
      res.send({ clientSecret: paymentIntent.client_secret });
    });

    // update data for payment
    app.patch("/booking", async (req, res) => {
      const payment = req.body;
      const buyerEmail = req.query.email;
      const productId = req.query.id;
      const query = { buyerEmail: buyerEmail, productId: productId };
      const updatedDoc = {
        $set: {
          transactionId: payment.transactionId,
          paid: payment.paid,
        },
      };
      const result = await bookingsCollection.updateOne(query, updatedDoc);
      // delete from advertise items
      const query2 = { productId: productId };
      const result2 = await advertiseCollection.deleteOne(query2);

      // delete from wishlist
      const query3 = { productId: productId, buyerEmail: buyerEmail };
      const result3 = await wishListCollection.deleteOne(query3);

      // send in the first result
      if (result.acknowledged) {
        res.send({
          status: true,
          message: "Payment successfully done",
        });
      } else {
        res.send({
          status: false,
          message: "An error occurred! Please try again!",
        });
      }
    });
  } finally {
  }
}

run().catch((error) => console.error(error));

app.listen(port, () => {
  console.log(`App running on port ${port}`);
});
