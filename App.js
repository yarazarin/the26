const express = require("express");
const cors = require("cors");
const sharp = require('sharp');
const stream = require('stream');

const multer = require("multer");
const {
  S3Client,
  ListObjectsCommand,
  PutObjectCommand,
  GetObjectCommand,
} = require("@aws-sdk/client-s3");

// Create an Express application
const app = express();
const port = 3000;

// CORS configuration
const corsOptions = {
origin: 'http://the26.s3-website-us-east-1.amazonaws.com',
    optionsSuccessStatus: 200 // some legacy browsers (IE11, various SmartTVs) choke on 204
  }
  
  app.use(cors(corsOptions));

// AWS S3 configuration
const s3Client = new S3Client({ region: "us-east-1" }); // Change the region as needed

// Multer middleware configuration for handling file uploads
const upload = multer({ dest: "uploads/" });

app.use(express.static("public"));

// Endpoint to list all objects in a bucket
app.get("/listObjects", async (req, res) => {
  try {
    const command = new ListObjectsCommand({ Bucket: "the26" });
    const data = await s3Client.send(command);
    res.json(data.Contents.map((object) => object.Key));
  } catch (err) {
    console.error("Error listing objects:", err);
    res.status(500).send("Error listing objects");
  }
});

// Endpoint to upload an object to a bucket
app.post("/upload", upload.single("file"), async (req, res) => {
  try {
    const file = req.file;
    // Check if the file is an image
    if (!file.mimetype.startsWith('image/')) {
      return res.status(400).send('Please upload an image file');
    }
    const uploadParams = {
      Bucket: "the26",
      Key: file.originalname,
      Body: require("fs").createReadStream(file.path),
    };
    await s3Client.send(new PutObjectCommand(uploadParams));
    res.send("Object uploaded successfully");
  } catch (err) {
    console.error("Error uploading object:", err);
    res.status(500).send("Error uploading object");
  }
});

// Endpoint to retrieve an object from a bucket
app.get("/getObject/:key", async (req, res) => {
  const key = req.params.key;
  try {
    const command = new GetObjectCommand({ Bucket: "the26", Key: key });
    const data = await s3Client.send(command);

    // Create a transform stream to resize the image
    const transform = sharp().resize({
      width: 300,
      height: 400,
      fit: sharp.fit.cover,
      position: sharp.strategy.entropy
    });

    // Use a PassThrough stream to avoid prematurely closing the Readable stream
    const passThrough = new stream.PassThrough();

    // Pipe the data to the transform stream and then to the response
    stream.pipeline(data.Body, transform, passThrough, err => {
      if (err) {
        console.error('Error while transforming image:', err);
        res.status(500).send('Error while transforming image');
      }
    });

    passThrough.pipe(res);
  } catch (err) {
    console.error("Error retrieving object:", err);
    res.status(500).send("Error retrieving object");
  }
});

// Start the Express server
app.listen(port, () => {
  console.log(
    `Server is running on http://ec2-34-230-57-124.compute-1.amazonaws.com:${port}`
  );
});
