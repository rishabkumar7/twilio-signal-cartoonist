const roomList = document.getElementById("room-list");
const videoContainer = document.getElementById("video-container");

// Function to fetch and display active rooms
async function fetchRooms() {
  try {
    const response = await fetch("/active-rooms");
    const rooms = await response.json();
    
    // Clear existing rooms
    roomList.innerHTML = "";
    
    // Display each room
    rooms.forEach(room => {
      const roomCard = document.createElement("div");
      roomCard.className = "room-card";
      
      const duration = Math.floor(room.duration || 0);
      const minutes = Math.floor(duration / 60);
      const seconds = duration % 60;
      
      roomCard.innerHTML = `
        <h3>Room: ${room.name}</h3>
        <div class="room-info">
          <p>Participants: ${room.participants}</p>
          <p>Duration: ${minutes}:${seconds.toString().padStart(2, '0')}</p>
          <p>Created: ${new Date(room.created).toLocaleString()}</p>
        </div>
        <button class="join-button" onclick="joinRoom('${room.name}')">Join Room</button>
      `;
      
      roomList.appendChild(roomCard);
    });
  } catch (error) {
    console.error("Error fetching rooms:", error);
    roomList.innerHTML = "<p>Error loading rooms. Please try again.</p>";
  }
}

// Function to join a room
async function joinRoom(roomName) {
  try {
    // Hide the room list and show the video container
    roomList.style.display = "none";
    videoContainer.style.display = "block";
    
    // Fetch an Access Token from the join-room route
    const response = await fetch("/join-room", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ 
        roomName: roomName,
        identity: "Cartoonist" // Set a fixed identity for the cartoonist
      }),
    });
    const { token } = await response.json();

    // join the video room with the token
    const room = await joinVideoRoom(roomName, token);

    // render the local and remote participants' video and audio tracks
    handleConnectedParticipant(room.localParticipant);
    room.participants.forEach(handleConnectedParticipant);
    room.on("participantConnected", handleConnectedParticipant);

    // handle cleanup when a participant disconnects
    room.on("participantDisconnected", handleDisconnectedParticipant);
    window.addEventListener("pagehide", () => room.disconnect());
    window.addEventListener("beforeunload", () => room.disconnect());
  } catch (error) {
    console.error("Error joining room:", error);
    alert("Failed to join room. Please try again.");
  }
}

const handleConnectedParticipant = (participant) => {
  // create a div for this participant's tracks
  const participantDiv = document.createElement("div");
  participantDiv.setAttribute("id", participant.identity);
  videoContainer.appendChild(participantDiv);

  // iterate through the participant's published tracks and
  // call `handleTrackPublication` on them
  participant.tracks.forEach((trackPublication) => {
    handleTrackPublication(trackPublication, participant);
  });

  // listen for any new track publications
  participant.on("trackPublished", handleTrackPublication);
};

const handleTrackPublication = (trackPublication, participant) => {
  function displayTrack(track) {
    // append this track to the participant's div and render it on the page
    const participantDiv = document.getElementById(participant.identity);
    // track.attach creates an HTMLVideoElement or HTMLAudioElement
    // (depending on the type of track) and adds the video or audio stream
    participantDiv.append(track.attach());
  }

  // check if the trackPublication contains a `track` attribute. If it does,
  // we are subscribed to this track. If not, we are not subscribed.
  if (trackPublication.track) {
    displayTrack(trackPublication.track);
  }

  // listen for any new subscriptions to this track publication
  trackPublication.on("subscribed", displayTrack);
};

const handleDisconnectedParticipant = (participant) => {
  // stop listening for this participant
  participant.removeAllListeners();
  // remove this participant's div from the page
  const participantDiv = document.getElementById(participant.identity);
  participantDiv.remove();
};

const joinVideoRoom = async (roomName, token) => {
  // join the video room with the Access Token and the given room name
  const room = await Twilio.Video.connect(token, {
    room: roomName,
  });
  return room;
};

// Fetch rooms when the page loads
fetchRooms();

// Refresh rooms every 30 seconds
setInterval(fetchRooms, 30000); 