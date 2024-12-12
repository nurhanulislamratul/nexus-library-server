const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();
const port = process.env.PORT || 5000;
const app = express();

const corsOptions = {
  origin: [
    "http://localhost:5173",
    "http://localhost:5174",
    "https://fixnexus-aa0eb.web.app",
    "https://fixnexus-aa0eb.firebaseapp.com",
    "https://fixnexus.netlify.app",
  ],
  credentials: true,
  optionSuccessStatus: 200,
};
app.use(cors(corsOptions));
app.use(express.json());
app.use(cookieParser());

// Middle Ware JWT Verify
const verifyToken = (req, res, next) => {
  const token = req.cookies.token;

  if (!token) {
    return res.status(401).send({ message: "Unauthorized access" });
  }
  if (token) {
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, async (err, decoded) => {
      if (err) {
        console.log(err);
        return res.status(401).send({ message: "Unauthorized access" });
      }
      req.user = decoded;
      next();
    });
  }
};

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@atlascluster.xgsegjb.mongodb.net/?retryWrites=true&w=majority&appName=AtlasCluster`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    const servicesCollection = client.db("fixnexus").collection("services");
    const bookedServicesCollection = client
      .db("fixnexus")
      .collection("bookedServices");

    // jwt token generate
    app.post("/jwt", async (req, res) => {
      const email = req.body;
      const token = jwt.sign(email, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "1d",
      });
      res
        .cookie("token", token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
        })
        .send({ success: true });
    });

    // clear token on get request
    app.get("/logout", (req, res) => {
      res
        .clearCookie("token", {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
          maxAge: 0,
        })
        .send({ success: true });
    });

    // Get 6 items for home services
    app.get("/home-services", async (req, res) => {
      const services = await servicesCollection.find().limit(6).toArray();
      res.send(services);
    });

    // Get all services data
    app.get("/services", async (req, res) => {
      const size = parseInt(req.query.size);
      const page = parseInt(req.query.page) - 1;
      const search = req.query.search;
      let query = {
        serviceName: { $regex: search, $options: "i" },
      };

      const services = await servicesCollection
        .find(query)
        .skip(page * size)
        .limit(size)
        .toArray();
      res.send(services);
    });

    // Get all service data count from db
    app.get("/services-count", async (req, res) => {
      const search = req.query.search;
      let query = {
        serviceName: { $regex: search, $options: "i" },
      };
      const count = await servicesCollection.countDocuments(query);
      res.send({ count });
    });

    // Get a single service data by id
    app.get("/services/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const service = await servicesCollection.findOne(query);
      res.send(service);
    });

    // Get all managed service data by email
    app.get("/manage-services/:email", verifyToken, async (req, res) => {
      const tokenData = req.user;
      const email = req.params.email;

      if (email !== tokenData.email) {
        return res.status(403).send({ message: "Forbidden access" });
      }
      const query = { providerEmail: email };
      const services = await servicesCollection.find(query).toArray();
      res.send(services);
    });

    // Save a service data in MongoDB
    app.post("/services", async (req, res) => {
      const service = req.body;
      const result = await servicesCollection.insertOne(service);
      res.send(result);
    });

    // Delete a service data by id
    app.delete("/services/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await servicesCollection.deleteOne(query);
      res.send(result);
    });

    // Update a service data by id
    app.put("/services/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const service = req.body;
      const option = { upsert: true };
      const updatedService = {
        $set: {
          ...service,
        },
      };
      const result = await servicesCollection.updateOne(
        filter,
        updatedService,
        option
      );
      res.send(result);
    });

    // Save a booked service data in MongoDB
    app.post("/booked-services", async (req, res) => {
      const bookedService = req.body;
      const result = await bookedServicesCollection.insertOne(bookedService);
      res.send(result);
    });

    // Get all booked service data by email
    app.get("/booked-services/:email", verifyToken, async (req, res) => {
      const tokenData = req.user;
      const email = req.params.email;

      if (email !== tokenData.email) {
        return res.status(403).send({ message: "Forbidden access" });
      }
      const query = { userEmail: email };
      const services = await bookedServicesCollection.find(query).toArray();
      res.send(services);
    });

    // Update a booked service data by id
    app.patch("/booked-services/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const status = req.body;
      const updatedService = {
        $set: status,
      };

      const result = await bookedServicesCollection.updateOne(
        filter,
        updatedService
      );
      res.send(result);
    });

    // Delete a booked service data by id
    app.delete("/booked-services/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await bookedServicesCollection.deleteOne(query);
      res.send(result);
    });

    // Get all to-do service data by email
    app.get("/services-to-do/:email", verifyToken, async (req, res) => {
      const tokenData = req.user;
      const email = req.params.email;

      if (email !== tokenData.email) {
        return res.status(403).send({ message: "Forbidden access" });
      }
      const query = { providerEmail: email };
      // console.log(query);
      const services = await bookedServicesCollection.find(query).toArray();
      res.send(services);
    });

    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
  }
}
run().catch(console.log);

app.get("/", (req, res) => {
  res.send("FixNexus Server is running....");
});

app.listen(port, () => console.log(`Server running on port ${port}`));
