let fs;

try {
  // Node 14.x
  fs = require('fs/promises');
} catch (error) {
  // Node 12.x
  fs = require('fs').promises;
}

const got = require('got');

async function requestAndAnalyze(token, url) {

  const request = got(url, {
    headers: {
      'X-DCSS-MEDIA-REQUEST-TOKEN': token
    }
  });

  console.log(request);
  const buffer = await request.buffer();


  return buffer.length;
}

const express = require('express');
const SocketIO = require('socket.io');
const PORT = process.env.PORT || 4000;

const files = {
  '/': '/index.html',
};

const app = express();

app.get('*', async (req, res) => {
  let file = files['/'];
  if (files[req.path]) {
    file = files[req.path];
  }
  const contents = await fs.readFile(`${__dirname}${file}`, 'utf8');
  res.send(contents.replace('/***PORT***/', `${PORT}`));
});

const server = app.listen(PORT, () => console.log(`Listening on ${PORT}`));
const io = SocketIO(server);

const cache = {};
const count = 0;

io.on('connection', (socket) => {
  const {
    agent,
    chat,
    token,
    user
  } = socket.handshake.auth;

  socket.join(user.id);

  console.log('Received agent:', agent);
  console.log('Received chat:', chat);
  console.log('Received token:', token);
  console.log('Received user:', user);
  console.log('socket.id', socket.id);

  if (!cache[user.id]) {
    cache[user.id] = {
      agent,
      chat,
      user,
      count,
      rx: [],
      tx: []
    };
    // Only send the welcome message when this is the
    // first time the specific user is connecting.
    //
    // Send the response to the specified private
    // channel for this client socket connection.

    const sentiment = agent.configuration.sentiment;
    const message = `Hello, I will analyze your media file. Press the <enter> key to make a remote request`;
    io.to(user.id).emit('interjection', { message });
  }

  /*
    THIS IS THE IMPORTANT PART FOR CONSTRUCTING AN AGENT THAT
    TEACHER MOMENTS CAN INTERACT WITH
  */
  socket.on('request', async payload => {
    console.log('request', payload);
    if (!cache[user.id]) {
      // The session has been ended!
      return;
    }

    // "Process" the incoming data
    const result = await requestAndAnalyze(token, payload.value);

    const response = {
      ...payload,
      result
    };

    // Send the response to the specified private
    // channel for this client socket connection.
    io.to(user.id).emit('response', response);
  });

  socket.on('end', ({ auth, chat, user }) => {
    if (cache[user.id]) {
      io.to(user.id).emit('interjection', {
        message: 'Goodbye!'
      });
      cache[user.id] = null;
    }
  });
  /*
    END
  */
});
