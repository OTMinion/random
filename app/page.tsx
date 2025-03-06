"use client";

import { useState, useEffect, useRef } from "react";
import axios from "axios";

export default function Home() {
  // State for additional settings
  const [minRange, setMinRange] = useState(0);
  const [maxRange, setMaxRange] = useState(39);
  const [groupCount, setGroupCount] = useState(5);
  const [isBlurred, setIsBlurred] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [apiKey, setApiKey] = useState("sk_9402d7bebe4299be54cd81dc6fd3f75e066bed9e3e182676");
  const [pauseDuration, setPauseDuration] = useState(500); // Pause duration in milliseconds

  // State for generated numbers and user input
  const [generatedNumbers, setGeneratedNumbers] = useState<string[]>([]);
  const [userInput, setUserInput] = useState("");
  const [inputValidation, setInputValidation] = useState<boolean[]>([]);
  const [showResults, setShowResults] = useState(false);

  // Refs
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const isPlayingRef = useRef(false);
  const audioQueueRef = useRef<string[]>([]);

  // Generate random numbers based on user criteria
  const generateRandomNumbers = () => {
    if (isGenerating) return;

    // Stop any currently playing audio
    if (audioRef.current) {
      audioRef.current.pause();
      if (audioRef.current.src) {
        URL.revokeObjectURL(audioRef.current.src);
        audioRef.current.src = "";
      }
    }

    // Reset playing state
    isPlayingRef.current = false;

    setIsGenerating(true);
    setShowResults(false);
    setUserInput("");
    setInputValidation([]);

    const numbers: string[] = [];
    for (let i = 0; i < groupCount; i++) {
      const firstTwoDigits = Math.floor(Math.random() * (maxRange - minRange + 1) + minRange)
        .toString()
        .padStart(2, "0");
      const lastDigit = Math.floor(Math.random() * 10);
      numbers.push(`${firstTwoDigits}${lastDigit}`);
    }

    setGeneratedNumbers(numbers);

    // Small delay to ensure state is updated before playing
    setTimeout(() => {
      // Read the entire sequence as one audio file
      readEntireSequence(numbers);
      setIsGenerating(false);
    }, 500);
  };

  // Text-to-speech using ElevenLabs for the entire sequence
  const readEntireSequence = async (numbers: string[]) => {
    if (!apiKey || numbers.length === 0) return;

    try {
      // Format the entire sequence with pauses between groups
      // The commas cause the voice to naturally pause
      // You can adjust the number of commas to control pause length
      let formattedText = "";

      for (let i = 0; i < numbers.length; i++) {
        // Format each digit with spaces for clearer speech
        formattedText += numbers[i].split("").join(" ");

        // Add pause between groups (not after the last one)
        if (i < numbers.length - 1) {
          // Number of commas controls pause length - adjust as needed
          // More commas = longer pause
          const pauseMarkers =
            pauseDuration <= 300
              ? ","
              : pauseDuration <= 600
              ? ",,"
              : pauseDuration <= 1000
              ? ",,,"
              : ",,,,";
          formattedText += " " + pauseMarkers + " ";
        }
      }

      console.log("Reading full sequence:", formattedText);

      const response = await axios.post(
        "https://api.elevenlabs.io/v1/text-to-speech/21m00Tcm4TlvDq8ikWAM", // Rachel voice ID
        {
          text: formattedText,
          model_id: "eleven_monolingual_v1",
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
          },
        },
        {
          headers: {
            "Content-Type": "application/json",
            "xi-api-key": apiKey,
          },
          responseType: "blob",
        }
      );

      console.log("API response received:", response.status);
      const audioUrl = URL.createObjectURL(response.data);

      if (audioRef.current) {
        // Stop any currently playing audio
        audioRef.current.pause();
        if (audioRef.current.src) {
          URL.revokeObjectURL(audioRef.current.src);
        }

        // Set the new audio source and play it
        audioRef.current.src = audioUrl;
        audioRef.current.play().catch((error) => {
          console.error("Error playing audio:", error);
        });
      }

      return audioUrl;
    } catch (error) {
      console.error("Error with ElevenLabs API:", error);
      if (axios.isAxiosError(error)) {
        console.error("Response:", error.response?.data);
        console.error("Status:", error.response?.status);
      }
      return null;
    }
  };

  // Keep this function for individual number reading if needed
  const textToSpeech = async (text: string) => {
    if (!apiKey) return null;

    try {
      console.log("Calling ElevenLabs API with text:", text);

      const response = await axios.post(
        "https://api.elevenlabs.io/v1/text-to-speech/21m00Tcm4TlvDq8ikWAM", // Rachel voice ID
        {
          text,
          model_id: "eleven_monolingual_v1",
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
          },
        },
        {
          headers: {
            "Content-Type": "application/json",
            "xi-api-key": apiKey,
          },
          responseType: "blob",
        }
      );

      console.log("API response received:", response.status);
      const audioUrl = URL.createObjectURL(response.data);
      console.log("Audio URL created:", audioUrl);
      return audioUrl;
    } catch (error) {
      console.error("Error with ElevenLabs API:", error);
      if (axios.isAxiosError(error)) {
        console.error("Response:", error.response?.data);
        console.error("Status:", error.response?.status);
      }
      return null;
    }
  };

  // Play audio for each number in sequence
  const playNextNumber = async () => {
    if (isPlayingRef.current || audioQueueRef.current.length === 0) return;

    isPlayingRef.current = true;
    const currentNumber = audioQueueRef.current.shift();

    if (currentNumber) {
      // Format the number for natural speech reading - read each digit separately
      const formatted = currentNumber.split("").join(" ");
      console.log("Reading number:", formatted);
      const audioUrl = await textToSpeech(formatted);

      if (audioUrl && audioRef.current) {
        audioRef.current.src = audioUrl;
        audioRef.current.oncanplaythrough = () => {
          audioRef.current?.play().catch((error) => {
            console.error("Error playing audio:", error);
            isPlayingRef.current = false;
            playNextNumber();
          });
        };

        // Set a timeout as a fallback in case the audio doesn't trigger events properly
        setTimeout(() => {
          if (isPlayingRef.current) {
            isPlayingRef.current = false;
            playNextNumber();
          }
        }, 3000);
      } else {
        console.error("Failed to get audio URL or audio reference is null");
        isPlayingRef.current = false;
        playNextNumber();
      }
    }
  };

  // Handle audio ended event
  const handleAudioEnded = () => {
    console.log("Audio ended, playing next number");
    isPlayingRef.current = false;
    setTimeout(() => playNextNumber(), 500); // Small delay between numbers
  };

  // Validate user input against generated numbers
  const validateInput = (input: string) => {
    const userNumbers = input.replace(/\D/g, "");
    const validationResult: boolean[] = [];

    // Check each character
    for (let i = 0; i < userNumbers.length; i++) {
      const targetIndex = Math.floor(i / 3);
      const positionInGroup = i % 3;

      if (targetIndex >= generatedNumbers.length) break;

      const targetDigit = generatedNumbers[targetIndex][positionInGroup];
      validationResult[i] = userNumbers[i] === targetDigit;
    }

    setInputValidation(validationResult);
  };

  // Calculate the score based on correct digits
  const calculateScore = () => {
    if (!inputValidation.length) return 0;
    const correct = inputValidation.filter((v) => v).length;
    return Math.round((correct / generatedNumbers.join("").length) * 100);
  };

  // Handle user input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setUserInput(value);
    validateInput(value);
  };

  // Check results
  const checkResults = () => {
    setShowResults(true);
  };

  // Effect for audio element
  useEffect(() => {
    // Set up the audio element event listeners when the component mounts
    const setupAudioListeners = () => {
      if (audioRef.current) {
        // Remove any existing listeners to prevent duplicates
        audioRef.current.removeEventListener("ended", handleAudioEnded);

        // Add the ended event listener
        audioRef.current.addEventListener("ended", handleAudioEnded);

        console.log("Audio event listeners set up");
      }
    };

    // Call setup immediately
    setupAudioListeners();

    // And also whenever the audioRef changes
    return () => {
      if (audioRef.current) {
        audioRef.current.removeEventListener("ended", handleAudioEnded);
      }
    };
  }, [audioRef.current]);

  // Debug effect for troubleshooting audio
  useEffect(() => {
    console.log(
      "App initialized with API key:",
      apiKey ? "Present (hidden for security)" : "Not present"
    );

    // Create a test audio element
    const testAudio = new Audio();
    testAudio.oncanplaythrough = () => console.log("Browser can play audio");
    testAudio.onerror = () => console.log("Browser had error loading audio");

    return () => {
      // Clean up any audio resources
      if (audioRef.current) {
        const currentSrc = audioRef.current.src;
        if (currentSrc) {
          URL.revokeObjectURL(currentSrc);
        }
      }
    };
  }, []);

  return (
    <main className="flex min-h-screen flex-col items-center p-8 bg-gray-50 text-black">
      <h1 className="text-3xl font-bold mb-8">Random Number Generator</h1>

      <div className="w-full max-w-md bg-white p-6 rounded-lg shadow-md mb-8">
        <h2 className="text-xl font-semibold mb-4">Settings</h2>

        <div className="text-sm text-gray-500 mb-4">Voice API is configured and ready to use.</div>

        {/* API key is pre-filled - you can uncomment this if you want to change it
        <div className="mb-4">
          <label className="block text-sm font-medium mb-1">ElevenLabs API Key:</label>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="Enter your API key"
            className="w-full p-2 border rounded"
          />
        </div>
        */}

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium mb-1">Min Range:</label>
            <input
              type="number"
              min="0"
              max="99"
              value={minRange}
              onChange={(e) => setMinRange(Number(e.target.value))}
              className="w-full p-2 border rounded"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Max Range:</label>
            <input
              type="number"
              min="0"
              max="99"
              value={maxRange}
              onChange={(e) => setMaxRange(Number(e.target.value))}
              className="w-full p-2 border rounded"
            />
          </div>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium mb-1">Number of Groups:</label>
          <input
            type="number"
            min="1"
            max="20"
            value={groupCount}
            onChange={(e) => setGroupCount(Number(e.target.value))}
            className="w-full p-2 border rounded"
          />
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium mb-1">Pause Between Numbers (ms):</label>
          <input
            type="range"
            min="200"
            max="2000"
            step="100"
            value={pauseDuration}
            onChange={(e) => setPauseDuration(Number(e.target.value))}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-gray-500">
            <span>Short ({pauseDuration}ms)</span>
            <span>Long</span>
          </div>
        </div>

        <div className="flex items-center mb-4">
          <input
            type="checkbox"
            id="blurNumbers"
            checked={isBlurred}
            onChange={() => setIsBlurred(!isBlurred)}
            className="mr-2"
          />
          <label htmlFor="blurNumbers" className="text-sm font-medium">
            Blur Numbers
          </label>
        </div>

        <button
          onClick={generateRandomNumbers}
          disabled={isGenerating}
          className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 transition-colors"
        >
          Generate Numbers
        </button>
      </div>

      {generatedNumbers.length > 0 && (
        <div className="w-full max-w-md bg-white p-6 rounded-lg shadow-md mb-8">
          <h2 className="text-xl font-semibold mb-4">Generated Numbers</h2>

          {/* Only blur the numbers, not the entire website */}
          <div className="text-2xl font-mono tracking-wider text-center p-4 rounded bg-gray-100 mb-4">
            {isBlurred ? (
              <span className="blur-sm">{generatedNumbers.join(" - ")}</span>
            ) : (
              generatedNumbers.join(" - ")
            )}
          </div>

          <audio ref={audioRef} controls className="w-full mb-4" />

          <button
            onClick={() => {
              // Read the entire sequence again
              readEntireSequence(generatedNumbers);
            }}
            className="w-full bg-green-600 text-white py-2 rounded hover:bg-green-700 transition-colors mb-4"
          >
            Read Numbers Again
          </button>

          <h3 className="font-medium mb-2">Your Recall:</h3>
          <input
            type="text"
            value={userInput}
            onChange={handleInputChange}
            placeholder="Type the numbers you remember..."
            className="w-full p-2 border rounded mb-4"
          />

          <div className="flex mb-4">
            {userInput.split("").map((char, index) => {
              if (/\d/.test(char)) {
                const isValid = inputValidation[index];
                return (
                  <span
                    key={index}
                    className={`text-lg font-mono ${isValid ? "text-green-600" : "text-red-600"}`}
                  >
                    {char}
                  </span>
                );
              }
              return (
                <span key={index} className="text-lg font-mono">
                  {char}
                </span>
              );
            })}
          </div>

          <button
            onClick={checkResults}
            className="w-full bg-purple-600 text-white py-2 rounded hover:bg-purple-700 transition-colors"
          >
            Check Results
          </button>

          {showResults && (
            <div className="mt-4 p-4 bg-gray-100 rounded">
              <h3 className="font-medium mb-2">Results:</h3>
              <p className="mb-2">
                Correct numbers: {inputValidation.filter((v) => v).length} /{" "}
                {generatedNumbers.join("").length}
              </p>
              <p className="font-bold">Score: {calculateScore()}%</p>
              <p className="mt-2">Correct sequence: {generatedNumbers.join(" - ")}</p>
            </div>
          )}
        </div>
      )}
    </main>
  );
}
