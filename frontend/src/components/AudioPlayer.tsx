import {  Play, Square  } from 'lucide-react';
import  { useState } from 'react'

function AudioPlayer({ content }: { content: string }) {
    const [isPlaying, setIsPlaying] = useState(false);

    const handlePlayAudio = () => {
        if(!content) return;
        try {
          if ('speechSynthesis' in window) {
            // Cancel any previous speech
            setIsPlaying(true);
            window.speechSynthesis.cancel();
            const utter = new window.SpeechSynthesisUtterance(content);
            // Optionally, select a voice (Tibetan not widely supported, will fallback to default)
            // For custom voice selection, add code here if needed
            utter.rate = 1; // Normal speaking rate
            utter.pitch = 1;
            window.speechSynthesis.speak(utter);
            
            utter.onend = () => {
                setIsPlaying(false);
            }
            utter.onerror = () => {
                setIsPlaying(false);
            }
          } else {
            alert('Audio playback is not supported in this browser.');
          }
        } catch (e) {
          // Fallback error handling
          alert('Unable to play audio: ' + (e as Error).message);
        }
      }
    const handlePauseAudio = () => {
        if(isPlaying)
        window.speechSynthesis.cancel();
        setIsPlaying(false);
    }
  return (
    <button
    type="button"
    className="ml-2 p-1 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
    title="Play Audio"
    aria-label="Play Audio"
    onClick={isPlaying ? handlePauseAudio : handlePlayAudio}
  >
    {isPlaying ? <Square /> : <Play />}
  </button>
  )
}

export default AudioPlayer
