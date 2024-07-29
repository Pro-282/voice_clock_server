const express = require('express');
const path = require('path');
const OpenAI = require('openai');
const dotenv = require('dotenv');
const cors = require('cors');
const fs = require('fs');
const http = require('http');
const socketIo = require('socket.io');
const bodyParser = require('body-parser');
const { log } = require('console');
const fileUpload = require('express-fileupload');
const stream = require('stream');
const FormData = require('form-data');
const fetch = require('node-fetch');

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(cors());
app.use(fileUpload());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '/frontend')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '/frontend/index.html'));
});

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    organization: 'org-aktkxrNZRBIxltD4tfEiaO54',
});

app.post('/transcribe', async(req, res) => {
    const audio = req.files['file'];
    if (!audio) {
        return res.status(400).json({ error: 'No audio file uploaded.' });
    }
    const audioStream = new stream.PassThrough();
    audioStream._read = ()=>{};
    audioStream.push(audio.data);
    audioStream.push(null);

    const body = new FormData();

    try {
        body.append("model", "whisper-1")
        body.append("language", "en")
        body.append("response_format", "json")
        body.append("prompt", "the received audio is meant to be a command for a smart clock, which can contain words such as alarm, timer, and other clock and time terms and numbers")
        
        body.append("file", audioStream, {filename: audio.name})
        const transcriptions_res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
            method: "POST",
            body,
            headers: {
                Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
            },
        })
        const transcription = (await transcriptions_res.json());

        // Call the chat completions API
        const chatCompletion = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [
                {
                    role: "system",
                    content: `you are an AI assistant for my smart clock. you are to convert the received command prompt into a set of json, there are generally two sets of commands one for setting a timer and the other for setting an alarm, if the received command is for setting a timer return a json output with this format:{"mode": "timer","time_hour": xx,"time_min": yy,"time_sec": zz} where xx is the implied number of hour, yy is the implied number for minute and zz is the implied seconds. and example: "set a timer for five minutes thirty seconds would result in {"mode":"timer","time_hour":0,"time_min":5,"time_sec":30}. another example would be "set a timer for one hour forty five minutes would result in {"mode":"timer","time_hour":1,"time_min":45,"time_sec":0}. the second second set of command which is for alarm you should give an output in this format: {"mode": "alarm","time_hour": xx,"time_min": yy} where xx is the implied number for hour in 24 hour clock format, and yy is the implied number for minute. an example would be: "set an alarm for one pm today" should result in {"mode":"alarm","time_hour":13,"time_min":00}, another example would be "set an alarm for nine forty five pm" should result in {"mode":"alarm","time_hour":21,"time_min":45}. if the input prompt does not have timer or alarm setting command give an error output of this output format: {"mode": "error"} for example "what is the weather like today?" should result in an error. your output should only be in the form of json and you are not to add any extra text apart from the specified json format`
                },
                {
                    role: "user",
                    content: transcription.text
                }
            ]
        });

        const chatResponse = chatCompletion.choices[0].message.content;
        console.log('Chat API Response:', chatResponse);

        // Parse the chatResponse into a JavaScript object
        const parsedResponse = JSON.parse(chatResponse);

        // Emit the parsed response to all connected clients
        io.emit('voice_command', parsedResponse);

        res.json({ 
            transcription: transcription.text,
            parsedCommand: parsedResponse
        });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: error.message });
    }
});

io.on('connection', (socket) => {
    console.log('A client connected');

    socket.on('disconnect', () => {
        console.log('A client disconnected');
    });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});