'use client'
import React, { useState, useEffect, use } from 'react';
import axios from 'axios';
import OpenAI from 'openai';


export const openai = new OpenAI({
  apiKey: process.env.NEXT_PUBLIC_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true 
});


const Chat = () => {
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [recording, setRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [chunks, setChunks] = useState<Blob[]>([]);
  const [loading, SetLoading]=useState(false)
  const [loadingAudio,setLoadingAudio]=useState(false)
  const [loadingAudioComplete,setLoadingAudioComplete]=useState(false)
  const [recordingComplete, setRecordingComplete] = useState(false);

  
  // useEffect hook to initialize media recorder
  useEffect(() => {
    const initializeMediaRecorder = async () => {
      try {
        // Requesting user media access
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        // Creating a new MediaRecorder instance
        const recorder = new MediaRecorder(stream);
        // Setting MediaRecorder instance to state
        setMediaRecorder(recorder);

        // Handling data available events
        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) {
            chunks.push(e.data);
          }
        };

        // Handling stop events
        recorder.onstop =  () => {
          setChunks(chunks)
          const clipName = 'clip'

          // Creating DOM elements for the recorded clip
          const clipContainer = document.createElement('article');
          const clipLabel = document.createElement('p');
          const audio = document.createElement('audio');
          const deleteButton = document.createElement('button');

          // Adding classes and attributes to the created elements
          clipContainer.classList.add('clip');
          audio.setAttribute('controls', '');
          deleteButton.innerHTML = 'Delete';
          clipLabel.innerHTML = clipName ?? '';

          // Appending elements to the container
          clipContainer.appendChild(audio);
          clipContainer.appendChild(clipLabel);
          clipContainer.appendChild(deleteButton);
          const soundClipsContainer = document.querySelector('.sound-clips');
          if (soundClipsContainer) {
            soundClipsContainer.appendChild(clipContainer);
          }
         
          // Blob Creation
          const blob = new Blob(chunks, { type: 'audio/mp3' });
          const audioURL = window.URL.createObjectURL(blob);
          audio.src = audioURL;
          setChunks([]);
           
          // Send Audio  to whisper
          const fileName = `${clipName}.mp3`;
          badAudioToGoodText(new File([blob], fileName, { type: 'audio/mp3' }))


          deleteButton.onclick = () => {
            clipContainer.remove();
          };
        };
      } catch (err) {
        console.error(`The following getUserMedia error occurred: ${err}`);
      }
    };

    // Checking for browser support and initializing media recorder
    if (navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === 'function') {
      initializeMediaRecorder();
    } else {
      console.log('MediaRecorder is not supported on your browser!');
    }
  }, [chunks]);

  // 1. Convert bad audio to good text using OpenAI
  const badAudioToGoodText= async (file:any) => {
    SetLoading(true)
    try{
      if (file) {

        // Making a POST request to OpenAI for audio transcriptions
        const response = await axios.post(
          'https://api.openai.com/v1/audio/transcriptions',
          {
            file,
            model:'whisper-1'
          },
          {
            headers: {
              Authorization: `Bearer ${process.env.NEXT_PUBLIC_OPENAI_API_KEY}`,
              'Content-Type': 'multipart/form-data',
            },
          }
        );
        
        // 2. Send Text Prompt To ChatGPT
        const gptResponse=await chatGPT(response.data.text)

        // 3 Convert ChatGPT response To Good Audio Format
        if(gptResponse){
          goodTextToGoodAudio(gptResponse)
        }        
      }

    }catch(error){
      console.log(error, 'While Using badAudioToGoodText Function!')
    }
    finally{
      SetLoading(false)
    }

    
  };

  const chatGPT = async (text:string) => {
    try{
      const response= await await openai.chat.completions.create({
        messages: [{ role: 'user', content: text }],
        model: 'gpt-3.5-turbo',
      });
      return response.choices[0].message.content
    }catch(error){
      console.log(error,':', 'Error While Using callGPT function')
    }
  }

  // This is used when we get Response from ChatGPT
  const goodTextToGoodAudio = async (text:string) => {
    try {
      setLoadingAudio(true);

      const response = await axios.post(
        'https://api.openai.com/v1/audio/speech',
        {
          model: 'tts-1-hd',
          voice: 'shimmer',
          input: text,
        },
        {
          headers: {
            Authorization: `Bearer ${process.env.NEXT_PUBLIC_OPENAI_API_KEY}`,
            'Content-Type': 'application/json',
          },
          responseType: 'arraybuffer',
        }
      );
      
      const audioData = new Blob([response.data], { type: 'audio/mpeg' });
      setAudioBlob(audioData);
    } catch (error) {
      console.error('Error during text-to-audio conversion:', error);
    } finally {
      setLoadingAudio(false);
      setLoadingAudioComplete(true)
    }
  };
    
  //  Function to handle record button click
  const handleRecordClick = () => {
    // Setting audioBlob state to null
    setAudioBlob(null);
    
    // Checking if mediaRecorder exists and not already recording
    if (mediaRecorder && !recording) {
      // Starting the media recorder && Setting recording state to true
      mediaRecorder.start();
      setRecording(true);
    }
  };

  const handleStopClick = () => {
    if (mediaRecorder && recording) {
      mediaRecorder.stop();
      setRecording(false);
      setRecordingComplete(true);
    }
  };


  return (
    <>
      <div className="w-1/4 m-auto rounded-md border p-4 bg-white">
        <div className="flex-1 flex w-full justify-between">
            <div className="space-y-1">
              <p className="text-sm font-medium leading-none">
                {recordingComplete ? "Recorded" : "Recording"}
              </p>
              <p className="text-sm text-muted-foreground">
                {recordingComplete
                  ? "Thanks for talking."
                  : "Start speaking..."}
              </p>
            </div>
            {recording && (
              <div className="rounded-full w-4 h-4 bg-red-400 animate-pulse" />
            )}
        </div>
      </div>

      <div className="flex items-center w-full">
          {recording ? (
            // Button for stopping recording
            <button
              onClick={handleStopClick} 
              className="mt-10 m-auto flex items-center justify-center bg-red-400 hover:bg-red-500 rounded-full w-20 h-20 focus:outline-none"
            >
              <svg
                className="h-12 w-12 "
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path fill="white" d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
              </svg>
            </button>
          ) : (
            // Button for starting recording
            <button
              onClick={handleRecordClick}
              className="mt-10 m-auto flex items-center justify-center bg-orange-400 hover:bg-orange-500 rounded-full w-20 h-20 focus:outline-none"
            >
              <svg
                viewBox="0 0 256 256"
                xmlns="http://www.w3.org/2000/svg"
                className="w-12 h-12 text-white"
              >
                <path fill="currentColor"  d="M128 176a48.05 48.05 0 0 0 48-48V64a48 48 0 0 0-96 0v64a48.05 48.05 0 0 0 48 48ZM96 64a32 32 0 0 1 64 0v64a32 32 0 0 1-64 0Zm40 143.6V232a8 8 0 0 1-16 0v-24.4A80.11 80.11 0 0 1 48 128a8 8 0 0 1 16 0a64 64 0 0 0 128 0a8 8 0 0 1 16 0a80.11 80.11 0 0 1-72 79.6Z"/>
              </svg>
            </button>
          )}
        </div>

      <br></br>
      <br></br>

      <div className="w-1/4 m-auto rounded-md border p-4 bg-white">
        <div className="flex-1 flex w-full justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium leading-none">
              {(loadingAudio || loading) && "AudioLoading..."}
            </p>
            <p className="text-sm text-muted-foreground">
              {loadingAudioComplete?  "Audio Loading Completed...":"Waiting Till User Speaks..."}
            </p>  
          </div>
          {(loadingAudio || loading) && (
            <div className="rounded-full w-4 h-4 bg-purple-400 animate-pulse" />
          )}
        </div>
      </div>
      <br></br>
      <br></br>

      <div className="h-full flex justify-center items-center">
        {audioBlob && (
          <audio controls>
            <source src={URL.createObjectURL(audioBlob)} type="audio/mpeg" />
            Your browser does not support the audio element.
          </audio>
        )}
      </div>
    </>
  );
};

export default Chat;

