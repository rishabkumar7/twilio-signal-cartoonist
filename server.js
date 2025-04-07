require("dotenv").config();
const { v4: uuidv4 } = require("uuid");
const AccessToken = require("twilio").jwt.AccessToken;
const VideoGrant = AccessToken.VideoGrant;
const express = require("express");
const path = require("path");
const app = express();
const port = 5001;

// use the Express JSON middleware
app.use(express.json());

// serve static files from the public directory
app.use(express.static("public"));

// create the twilioClient
const twilioClient = require("twilio")(
  process.env.TWILIO_API_KEY_SID,
  process.env.TWILIO_API_KEY_SECRET,
  { accountSid: process.env.TWILIO_ACCOUNT_SID }
);

const findOrCreateRoom = async (roomName) => {
  try {
    // see if the room exists already. If it doesn't, this will throw
    // error 20404.
    await twilioClient.video.v1.rooms(roomName).fetch();
  } catch (error) {
    // the room was not found, so create it
    if (error.code == 20404) {
      await twilioClient.video.v1.rooms.create({
        uniqueName: roomName,
        type: "group",
        statusCallback: `${process.env.BASE_URL}/room-status-callback`,
        statusCallbackMethod: 'POST',
        statusCallbackEvent: ['completed', 'ended'],
      });
    } else {
      // let other errors bubble up
      throw error;
    }
  }
};

const getAccessToken = (roomName, identity) => {
  // create an access token
  const token = new AccessToken(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_API_KEY_SID,
    process.env.TWILIO_API_KEY_SECRET,
    // use the provided identity or generate a random one
    { identity: identity || uuidv4() }
  );
  // create a video grant for this specific room
  const videoGrant = new VideoGrant({
    room: roomName,
  });

  // add the video grant
  token.addGrant(videoGrant);
  // serialize the token and return it
  return token.toJwt();
};

// Endpoint to get all active rooms
app.get("/active-rooms", async (req, res) => {
  try {
    const rooms = await twilioClient.video.v1.rooms.list({
      status: 'in-progress'
    });
    
    // Format the rooms data
    const formattedRooms = rooms.map(room => ({
      name: room.uniqueName,
      participants: room.participants,
      duration: room.duration,
      created: room.dateCreated,
      sid: room.sid
    }));
    
    res.json(formattedRooms);
  } catch (error) {
    console.error('Error fetching rooms:', error);
    res.status(500).json({ error: 'Failed to fetch rooms' });
  }
});

app.post("/join-room", async (req, res) => {
  // return 400 if the request has an empty body or no roomName
  if (!req.body || !req.body.roomName) {
    return res.status(400).send("Must include roomName argument.");
  }
  const roomName = req.body.roomName;
  const identity = req.body.identity; // Optional identity parameter
  
  // find or create a room with the given roomName
  await findOrCreateRoom(roomName);
  // generate an Access Token for a participant in this room
  const token = getAccessToken(roomName, identity);
  res.send({
    token: token,
  });
});

// Serve the cartoonist dashboard
app.get("/cartoonist", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "cartoonist.html"));
});

// Serve the user page
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Start the Express server
app.listen(port, () => {
  console.log(`Express server running on port ${port}`);
}); 