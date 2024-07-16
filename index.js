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