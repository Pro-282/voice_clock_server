const recordButton = document.getElementById('recordButton');
const statusDisplay = document.getElementById('status');
const transcriptionDisplay = document.getElementById('transcription');
const errorDisplay = document.getElementById('error');

let mediaRecorder;
let audioChunks = [];

recordButton.onpointerdown = async () => {
    recordButton.style = "background-color: #1976D2"
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder = new MediaRecorder(stream);
    
    mediaRecorder.ondataavailable = event => {
        audioChunks.push(event.data);
    };

    mediaRecorder.start();
    statusDisplay.innerText = 'Recording...';
};

recordButton.onpointerup = async () => {
    recordButton.style = "background-color: #ff3d5a"
    mediaRecorder.stop();
    statusDisplay.innerText = 'Stopped recording. Sending audio...';

    mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
        const file = new File([audioBlob], 'recording.wav', { type: "audio/wav" })

        const formData = new FormData()
        formData.append("file", file, 'recording.wav')
        
        const data = {};
        for (const [key, value] of formData.entries()) {
            console.log(key, ":", value);
        }

        try {
            const response = await fetch('/transcribe', {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                throw new Error('Failed to send audio to server.');
            }

            const result = await response.json();
            console.log(result);
            transcriptionDisplay.innerText = result.transcription;
            statusDisplay.innerText = 'Command sent';
        } catch (error) {
            console.error(error);
            errorDisplay.innerText = `Error: ${error.message}`;
            statusDisplay.innerText = 'Error sending audio.';
        } finally {
            audioChunks = [];
        }
    };
};