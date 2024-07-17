const Microphone = require("node-microphone");
const fs = require("fs");
const readline = require("readline");
const axios = require("axios");
const FormData = require("form-data");
const OpenAI = require("openai");
require("dotenv").config();

// Initialize OpenAI API client with the provided API key
const secretKey = process.env.OPENAI_API_KEY;
const openai = new OpenAI({
  apiKey: secretKey,
});

// Variables to store chat history and other components 
let chatHistory = []; // To store the conversation history
let mic, outputFile, micStream, rl; // Microphone, output file, microphone stream, and readline interface

console.log(
  `\n# # # # # # # # # # # # # # # # # # # # #\n# Welcome to Milan recruiter assistant  #\n# # # # # # # # # # # # # # # # # # # # #\n`
);

// Function to set up the readline interface for user input
const setupReadlineInterface = () => {
  rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true, // Make sure the terminal can capture keypress events
  });

  readline.emitKeypressEvents(process.stdin, rl);

  if (process.stdin.isTTY) {
    process.stdin.setRawMode(true);
  }

  // Handle keypress events
  process.stdin.on("keypress", (str, key) => {
    if (
      key &&
      (key.name.toLowerCase() === "return" ||
        key.name.toLowerCase() === "enter")
    ) {
      if (micStream) {
        stopRecordingAndProcess();
      } else {
        startRecording();
      }
    } else if (key && key.ctrl && key.name === "c") {
      process.exit(); // Handle ctrl+c for exiting
    } else if (key) {
      console.log("Exiting application...");
      process.exit(0);
    }
  });

  console.log("Press Enter when you're ready to start speaking.");
};

// Function to start recording audio from the microphone
const startRecording = () => {
  mic = new Microphone();
  outputFile = fs.createWriteStream("output.wav");
  micStream = mic.startRecording();

  // Write incoming data to the output file
  micStream.on("data", (data) => {
    outputFile.write(data);
  });

  // Handle microphone errors
  micStream.on("error", (error) => {
    console.error("Error: ", error);
  });

  console.log("Recording... Press Enter to stop");
};

// Function to stop recording and process the audio
const stopRecordingAndProcess = () => {
  if (mic && micStream) {
    micStream.on("end", () => {
      outputFile.end();
      console.log(`Recording stopped, processing audio...`);
      transcribeAndChat(); // Transcribe the audio and initiate chat
    });

    try {
      mic.stopRecording();
      micStream.emit("end"); // Emit 'end' event manually to ensure processing
    } catch (error) {
      console.error("Error stopping the microphone:", error);
    }
  } else {
    console.log("No active recording found.");
  }
};

// Function to transcribe audio to text and send it to the chatbot
async function transcribeAndChat() {
  const filePath = "output.wav";
  // note that the file size limitations are 25MB for Whisper

  // Prepare form data for the transcription request
  const form = new FormData();
  form.append("file", fs.createReadStream(filePath));
  form.append("model", "whisper-1");
  form.append("response_format", "text");

  try {
    // Post the audio file to OpenAI for transcription
    const transcriptionResponse = await axios.post(
      "https://api.openai.com/v1/audio/transcriptions",
      form,
      {
        headers: {
          ...form.getHeaders(),
          Authorization: `Bearer ${secretKey}`,
        },
      }
    );

    // Log the full transcription response to inspect it
    console.log('Full Transcription Response:', transcriptionResponse.data);

    // Extract transcribed text from the response
    const transcribedText = transcriptionResponse.data.text || transcriptionResponse.data; // Adjust based on actual structure
    console.log(`>> You said: ${transcribedText}`);

    // Check if transcribedText is undefined or null
    if (!transcribedText) {
      console.error("Transcription failed, received undefined text.");
      console.log("Press Enter to try again.");
      return;
    }

    // Prepare messages for the chatbot, including the transcribed text
    const messages = [
      {
        role: "system",
        content:
          "You are a helpful assistant providing concise responses in at most two sentences.",
      },
      ...chatHistory,
      { role: "user", content: transcribedText },
    ];

    // Send messages to the chatbot and get the response
    const chatResponse = await openai.chat.completions.create({
      messages: messages,
      // model: "gpt-3.5-turbo",
      model: "gpt-4o",
    });

    // Extract the chat response.
    const chatResponseText = chatResponse.choices[0].message.content;

    // Update chat history with the latest interaction
    chatHistory.push(
      { role: "user", content: transcribedText },
      { role: "assistant", content: chatResponseText }
    );

    // Log the chat response to the terminal
    console.log(`>> Assistant said: ${chatResponseText}`);

    // Reset microphone stream and prompt for new recording
    micStream = null;
    console.log("Press Enter to speak again, or any other key to quit.\n");
  } catch (error) {
    // Handle errors from the transcription or chatbot API
    if (error.response) {
      console.error(
        `Error: ${error.response.status} - ${error.response.statusText}`
      );
    } else {
      console.error("Error:", error.message);
    }
  }
}

// Initialize the readline interface
setupReadlineInterface();





