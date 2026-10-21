/**
 * Voice Expense Entry Modal (Speech Recognition & NLP Parser)
 * 
 * Features:
 * - Completely decoupled Hardware Microphone (getUserMedia) from Browser Speech Recognition (Web Speech API)
 * - Independent MicState ('idle' | 'requesting' | 'granted' | 'denied' | 'unavailable' | 'listening' | 'error')
 * - Independent SpeechState ('idle' | 'starting' | 'listening' | 'ended' | 'unsupported' | 'network-error' | 'not-allowed' | 'error')
 * - AudioContext + AnalyserNode live waveform visualization driven by real acoustic volume
 * - Real-time diagnostic badge displaying hardware connection, speech engine status, and audio level
 * - Zero-mic-dependency Sample Voice Phrases for instant testing & demonstrations
 * - Live transcript visualization with clear & inline manual editing
 * - Comprehensive lifecycle management preventing duplicate instances, memory leaks, and InvalidStateError
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Mic,
  MicOff,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  X,
  Volume2,
  RefreshCw,
  ArrowRight,
  ShieldCheck,
  Info,
  Activity,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import { TransactionCategory, PaymentMethod, TransactionType } from '../../types';

interface VoiceExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTransactionCreated: () => void;
}

export type MicState =
  | 'idle'
  | 'requesting'
  | 'granted'
  | 'denied'
  | 'unavailable'
  | 'listening'
  | 'error';

export type SpeechState =
  | 'idle'
  | 'starting'
  | 'listening'
  | 'ended'
  | 'unsupported'
  | 'network-error'
  | 'not-allowed'
  | 'error';

const SAMPLE_VOICE_PROMPTS = [
  'I spent 450 rupees on dinner at Pizza Hut using UPI',
  'Paid 3200 for electricity bill with net banking',
  'Uber cab to airport 850 rupees on credit card',
  'Bought groceries at Nature Basket for 1650 rupees with debit card',
  'Received 75000 monthly salary from Acme Tech in bank transfer',
];

export const VoiceExpenseModal: React.FC<VoiceExpenseModalProps> = ({
  isOpen,
  onClose,
  onTransactionCreated,
}) => {
  const { currency } = useAuth();
  const c = currency === 'INR' ? '₹' : '$';

  // Decoupled State Management
  const [micState, setMicState] = useState<MicState>('idle');
  const [speechState, setSpeechState] = useState<SpeechState>('idle');

  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [transcript, setTranscript] = useState<string>('');
  const [recordingSeconds, setRecordingSeconds] = useState<number>(0);
  const [step, setStep] = useState<'listen' | 'review'>('listen');
  const [isParsing, setIsParsing] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);
  const [audioLevel, setAudioLevel] = useState<number>(0);

  // Review fields
  const [amount, setAmount] = useState<number>(0);
  const [category, setCategory] = useState<TransactionCategory>('Food');
  const [merchant, setMerchant] = useState<string>('');
  const [type, setType] = useState<TransactionType>('EXPENSE');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('UPI / Instant Transfer');
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState<string>('');
  const [confidence, setConfidence] = useState<number>(92);

  const recognitionRef = useRef<any>(null);
  const timerRef = useRef<any>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);

  // Modal open / close lifecycle
  useEffect(() => {
    if (isOpen) {
      setStep('listen');
      setTranscript('');
      setErrorMsg(null);
      setInfoMsg(null);
      setRecordingSeconds(0);
      setIsRecording(false);
      setAudioLevel(0);
      setMicState('idle');

      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

      if (!SpeechRecognition) {
        setSpeechState('unsupported');
      } else {
        setSpeechState('idle');
      }
    } else {
      cleanupAudio();
    }
  }, [isOpen]);

  // Recording timer
  useEffect(() => {
    if (isRecording) {
      timerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRecording]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupAudio();
    };
  }, []);

  const cleanupAudio = () => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (analyserRef.current) {
      try {
        analyserRef.current.disconnect();
      } catch (_) {}
      analyserRef.current = null;
    }
    if (audioContextRef.current) {
      try {
        if (audioContextRef.current.state !== 'closed') {
          audioContextRef.current.close();
        }
      } catch (_) {}
      audioContextRef.current = null;
    }
    if (mediaStreamRef.current) {
      try {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      } catch (_) {}
      mediaStreamRef.current = null;
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch (err) {
        console.warn('[VOICE] Recognition abort on cleanup:', err);
      }
      recognitionRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setIsRecording(false);
    setAudioLevel(0);
  };

  if (!isOpen) return null;

  const toggleRecording = async () => {
    if (isRecording) {
      stopRecording();
    } else {
      await startRecording();
    }
  };

  const startRecording = async () => {
    setErrorMsg(null);
    setInfoMsg(null);
    setTranscript('');
    setRecordingSeconds(0);
    cleanupAudio();

    // STEP 1: Hardware Microphone Access via getUserMedia
    setMicState('requesting');
    let stream: MediaStream | null = null;

    if (navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === 'function') {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaStreamRef.current = stream;
        setMicState('granted');

        // Setup real-time Web Audio Analyser
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) {
          const audioCtx = new AudioCtx();
          audioContextRef.current = audioCtx;
          const source = audioCtx.createMediaStreamSource(stream);
          const analyser = audioCtx.createAnalyser();
          analyser.fftSize = 64;
          analyserRef.current = analyser;
          source.connect(analyser);

          const dataArray = new Uint8Array(analyser.frequencyBinCount);
          const updateAudioLevel = () => {
            if (analyserRef.current && mediaStreamRef.current) {
              analyserRef.current.getByteFrequencyData(dataArray);
              let sum = 0;
              for (let i = 0; i < dataArray.length; i++) {
                sum += dataArray[i];
              }
              const avg = sum / dataArray.length;
              setAudioLevel(Math.min(100, Math.round((avg / 128) * 100)));
              animFrameRef.current = requestAnimationFrame(updateAudioLevel);
            }
          };
          updateAudioLevel();
        }
      } catch (err: any) {
        console.warn('[VOICE] getUserMedia exception:', err.name, err.message);
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          setMicState('denied');
          setErrorMsg('Microphone access was denied by the browser or operating system. Check microphone permissions and try again.');
          return;
        } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
          setMicState('unavailable');
          setErrorMsg('No microphone device was detected. Please connect a microphone or use a sample phrase below.');
          return;
        } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
          setMicState('error');
          setErrorMsg('The microphone is already being used by another application. Please close other audio apps and try again.');
          return;
        } else if (err.name === 'SecurityError') {
          setMicState('error');
          setErrorMsg('Microphone access is unavailable in this browser context. Please use a secure origin or localhost.');
          return;
        } else {
          setMicState('error');
          setErrorMsg(`Microphone access error (${err.name || 'Unknown'}). Please try again or select a sample phrase.`);
          return;
        }
      }
    } else {
      setMicState('unavailable');
      setInfoMsg('Microphone API is not supported in this browser. You can type your expense or choose a sample phrase below.');
    }

    // STEP 2: Optional Browser Speech Recognition (Web Speech API)
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setSpeechState('unsupported');
      setIsRecording(true);
      setMicState('listening');
      setInfoMsg('Live speech recognition is not available in this browser. Your microphone is connected; you can type your expense or choose a sample phrase below.');
      return;
    }

    try {
      setSpeechState('starting');
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = 'en-IN'; // Indian English
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        console.info('[VOICE] SpeechRecognition started.');
        setIsRecording(true);
        setMicState('listening');
        setSpeechState('listening');
        setErrorMsg(null);
      };

      recognition.onresult = (event: any) => {
        let interim = '';
        let finalStr = '';
        for (let i = 0; i < event.results.length; i++) {
          const res = event.results[i];
          if (res.isFinal) {
            finalStr += res[0].transcript;
          } else {
            interim += res[0].transcript;
          }
        }
        const current = (finalStr || interim).trim();
        if (current) {
          setTranscript(current);
        }
      };

      recognition.onerror = (event: any) => {
        console.warn('[VOICE] SpeechRecognition event:', event.error, event.message || '');
        
        switch (event.error) {
          case 'not-allowed':
          case 'service-not-allowed':
            setSpeechState('not-allowed');
            // If microphone hardware is granted, NEVER show false "Microphone denied"
            setInfoMsg('Microphone hardware is connected, but browser speech recognition service is unavailable in this session. You can type your expense or choose a sample phrase below.');
            break;
          case 'network':
            setSpeechState('network-error');
            setInfoMsg('Browser speech recognition service is unavailable. Your microphone is still connected. You can type the transcript or use a sample phrase below.');
            break;
          case 'no-speech':
            setSpeechState('ended');
            setInfoMsg('No speech was detected. Click the microphone to try speaking again.');
            break;
          case 'audio-capture':
            setSpeechState('error');
            setInfoMsg('Speech recognition could not access the audio input. You can type your expense or use a sample phrase.');
            break;
          case 'aborted':
            setSpeechState('ended');
            break;
          default:
            setSpeechState('error');
            setInfoMsg(`Speech recognition notice (${event.error}). You can type your expense or choose a sample phrase below.`);
            break;
        }
      };

      recognition.onend = () => {
        console.info('[VOICE] SpeechRecognition ended.');
        setSpeechState('ended');
        setIsRecording(false);
        setMicState((prev) => (prev === 'listening' ? 'granted' : prev));
      };

      recognitionRef.current = recognition;
      recognition.start();
      setIsRecording(true);
      setMicState('listening');
    } catch (e: any) {
      console.warn('[VOICE] SpeechRecognition start warning:', e.name, e.message);
      setSpeechState('error');
      setIsRecording(true);
      setMicState('listening');
    }
  };

  const stopRecording = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        console.warn('[VOICE] recognition.stop() notice:', e);
      }
    }
    if (mediaStreamRef.current) {
      try {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      } catch (_) {}
      mediaStreamRef.current = null;
    }
    if (audioContextRef.current) {
      try {
        if (audioContextRef.current.state !== 'closed') {
          audioContextRef.current.close();
        }
      } catch (_) {}
      audioContextRef.current = null;
    }
    if (analyserRef.current) {
      try {
        analyserRef.current.disconnect();
      } catch (_) {}
      analyserRef.current = null;
    }
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    setIsRecording(false);
    setAudioLevel(0);
    setMicState('granted');
    setSpeechState('ended');
  };

  const handleProcessTranscript = async (textToParse?: string) => {
    const query = (textToParse || transcript).trim();
    if (!query) {
      setErrorMsg('Please speak into the microphone, type your expense, or select a sample phrase first.');
      return;
    }

    if (isRecording) {
      stopRecording();
    }

    setIsParsing(true);
    setErrorMsg(null);
    setInfoMsg(null);

    try {
      const res = await api.parseVoice(query);
      setAmount(Number(res.amount) || 0);
      setCategory(res.category || 'Food');
      setMerchant(res.merchant || 'Spoken Expense');
      setType(res.type || 'EXPENSE');
      setDate(res.date || new Date().toISOString().split('T')[0]);
      setPaymentMethod(res.paymentMethod || 'UPI / Instant Transfer');
      setNotes(res.notes || `Voice parsed from "${query}"`);
      setConfidence(res.confidence || 90);

      setIsParsing(false);
      setStep('review');
    } catch (err: any) {
      setIsParsing(false);
      setErrorMsg(err.message || 'We could not interpret the expense. Please review or try again.');
    }
  };

  const handleSelectSamplePhrase = (prompt: string) => {
    // 100% Zero-mic dependency: immediately populate & parse
    cleanupAudio();
    setErrorMsg(null);
    setInfoMsg(null);
    setTranscript(prompt);
    handleProcessTranscript(prompt);
  };

  const handleConfirmTransaction = async () => {
    if (amount <= 0) {
      setErrorMsg('Amount must be greater than zero.');
      return;
    }

    setIsSaving(true);
    setErrorMsg(null);

    try {
      await api.createTransaction({
        date,
        description: `${merchant} (${category})`,
        amount: Number(amount),
        type,
        category,
        paymentMethod,
        merchant,
        notes,
        source: 'VOICE_ENTRY',
      });

      onTransactionCreated();
      handleClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to save transaction.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    cleanupAudio();
    setStep('listen');
    setTranscript('');
    setErrorMsg(null);
    setInfoMsg(null);
    setMicState('idle');
    setSpeechState('idle');
    onClose();
  };

  const categories: TransactionCategory[] = [
    'Food',
    'Groceries',
    'Transport',
    'Shopping',
    'Entertainment',
    'Bills',
    'Utilities',
    'Healthcare',
    'Education',
    'Travel',
    'Subscriptions',
    'Rent',
    'Salary',
    'Freelance',
    'Other',
  ];

  const paymentMethods: PaymentMethod[] = [
    'UPI / Instant Transfer',
    'Credit Card',
    'Debit Card',
    'Net Banking',
    'Bank Transfer',
    'Cash',
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100">
              <Mic className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-semibold text-slate-900">Voice Expense Entry</h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-indigo-50 text-indigo-700 border border-indigo-200">
                  NLP Parser
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Speak naturally or click sample phrases to record transactions instantly
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            title="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1">
          {/* Diagnostic Status Bar */}
          <div className="mb-4 p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 text-[11px] grid grid-cols-3 gap-2">
            <div className="flex items-center gap-1.5">
              <span className="text-slate-500">Hardware Mic:</span>
              <span
                className={`font-semibold ${
                  micState === 'granted' || micState === 'listening'
                    ? 'text-emerald-600'
                    : micState === 'denied'
                    ? 'text-rose-600'
                    : micState === 'requesting'
                    ? 'text-amber-600'
                    : 'text-slate-600'
                }`}
              >
                {micState === 'granted' || micState === 'listening'
                  ? '✓ Connected'
                  : micState === 'denied'
                  ? '✗ Denied'
                  : micState === 'requesting'
                  ? 'Connecting...'
                  : 'Idle'}
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-slate-500">Speech Engine:</span>
              <span
                className={`font-semibold ${
                  speechState === 'listening'
                    ? 'text-indigo-600'
                    : speechState === 'starting'
                    ? 'text-amber-600'
                    : speechState === 'unsupported' || speechState === 'not-allowed' || speechState === 'network-error'
                    ? 'text-amber-600'
                    : 'text-slate-600'
                }`}
              >
                {speechState === 'listening'
                  ? '✓ Listening'
                  : speechState === 'starting'
                  ? 'Starting...'
                  : speechState === 'unsupported'
                  ? 'Manual Mode'
                  : speechState === 'not-allowed' || speechState === 'network-error'
                  ? 'Offline/Manual'
                  : 'Ready'}
              </span>
            </div>

            <div className="flex items-center gap-1.5 justify-end">
              <span className="text-slate-500">Audio Input:</span>
              <span
                className={`font-semibold ${
                  audioLevel > 5 ? 'text-emerald-600' : 'text-slate-500'
                }`}
              >
                {audioLevel > 5 ? `✓ ${audioLevel}%` : 'Idle'}
              </span>
            </div>
          </div>

          {/* Error Banner */}
          {errorMsg && (
            <div className="mb-4 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="flex-1">
                <span>{errorMsg}</span>
              </div>
            </div>
          )}

          {/* Info / Neutral Notice Banner */}
          {infoMsg && !errorMsg && (
            <div className="mb-4 p-3.5 rounded-xl bg-indigo-50/70 border border-indigo-200 text-indigo-800 text-xs flex items-start gap-2.5">
              <Info className="w-4 h-4 shrink-0 mt-0.5 text-indigo-600" />
              <div className="flex-1">
                <span>{infoMsg}</span>
              </div>
            </div>
          )}

          {step === 'listen' && (
            <div className="space-y-6">
              {/* Mic Visualizer Container */}
              <div className="flex flex-col items-center justify-center py-6 bg-slate-50/60 rounded-2xl border border-slate-100">
                <div className="relative">
                  {isRecording && (
                    <div className="absolute inset-0 rounded-full bg-rose-400/30 animate-ping" />
                  )}
                  <button
                    onClick={toggleRecording}
                    className={`relative w-20 h-20 rounded-full flex items-center justify-center shadow-lg transition-all cursor-pointer ${
                      isRecording
                        ? 'bg-rose-600 hover:bg-rose-700 text-white ring-4 ring-rose-200 scale-105'
                        : 'bg-indigo-600 hover:bg-indigo-700 text-white ring-4 ring-indigo-100 hover:scale-105 active:scale-95'
                    }`}
                    title={isRecording ? 'Click to stop recording' : 'Click to start microphone'}
                  >
                    {isRecording ? (
                      <MicOff className="w-8 h-8 animate-pulse" />
                    ) : (
                      <Mic className="w-8 h-8" />
                    )}
                  </button>
                </div>

                <div className="mt-4 text-center">
                  <p className="text-sm font-semibold text-slate-800">
                    {isRecording
                      ? 'Listening... Speak your expense'
                      : transcript.trim()
                      ? 'Voice captured successfully'
                      : 'Click microphone to start'}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {isRecording
                      ? `Recording (${recordingSeconds}s) — Click mic again to stop`
                      : 'e.g. "I spent 450 rupees on dinner at Pizza Hut using UPI"'}
                  </p>
                </div>

                {/* Real Acoustic Audio Waveform Bar Animation */}
                {isRecording && (
                  <div className="flex items-center gap-1.5 mt-4 h-7">
                    {[16, 24, 12, 32, 20, 28, 14, 26, 18, 30].map((baseH, i) => {
                      const dynamicH = Math.max(8, Math.min(32, Math.round(baseH * (0.4 + (audioLevel / 80)))));
                      return (
                        <div
                          key={i}
                          className="w-1.5 bg-rose-500 rounded-full transition-all duration-75"
                          style={{ height: `${dynamicH}px` }}
                        />
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Live Transcript / Manual Input Box */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center justify-between">
                  <span>Detected Voice Transcript</span>
                  {transcript && (
                    <button
                      onClick={() => {
                        setTranscript('');
                        setErrorMsg(null);
                        setInfoMsg(null);
                      }}
                      className="text-[11px] text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      Clear
                    </button>
                  )}
                </label>
                <div className="relative">
                  <textarea
                    rows={2}
                    value={transcript}
                    onChange={(e) => {
                      setTranscript(e.target.value);
                      if (errorMsg) setErrorMsg(null);
                    }}
                    placeholder="Transcript will appear here as you speak, or select a sample phrase below..."
                    className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Sample Phrases (Always available without microphone permissions) */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Sample Voice Phrases (Click to Test)
                  </span>
                  <span className="text-[11px] text-indigo-600 font-medium flex items-center gap-1">
                    <Info className="w-3 h-3" />
                    Works Without Mic
                  </span>
                </div>
                <div className="space-y-1.5">
                  {SAMPLE_VOICE_PROMPTS.map((prompt, i) => (
                    <button
                      key={i}
                      onClick={() => handleSelectSamplePhrase(prompt)}
                      className="w-full text-left p-2.5 rounded-xl border border-slate-200 bg-white hover:bg-indigo-50/40 hover:border-indigo-200 text-xs text-slate-700 transition-all flex items-center justify-between group cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <Volume2 className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                        <span className="group-hover:text-indigo-600 font-medium">"{prompt}"</span>
                      </div>
                      <ArrowRight className="w-3 h-3 text-slate-300 group-hover:text-indigo-600 group-hover:translate-x-0.5 transition-transform shrink-0" />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: Review Screen */}
          {step === 'review' && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="text-xs font-semibold text-emerald-900">
                    Interpreted with {confidence}% NLP confidence
                  </span>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-semibold uppercase">
                  {type}
                </span>
              </div>

              {/* Form Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Amount ({c})
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={amount}
                    onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 text-sm font-semibold text-slate-900 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Type
                  </label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as TransactionType)}
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  >
                    <option value="EXPENSE">EXPENSE</option>
                    <option value="INCOME">INCOME</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Merchant / Description
                  </label>
                  <input
                    type="text"
                    value={merchant}
                    onChange={(e) => setMerchant(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Category
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as TransactionCategory)}
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  >
                    {categories.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Payment Method
                  </label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  >
                    {paymentMethods.map((pm) => (
                      <option key={pm} value={pm}>
                        {pm}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Date
                  </label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Original Voice Note
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center gap-2.5 text-xs text-slate-600">
                <ShieldCheck className="w-4 h-4 text-indigo-600 shrink-0" />
                <span>
                  Will be recorded on the private database and anchored to Hyperledger Fabric block ledger.
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
          {step === 'listen' ? (
            <>
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-800 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleProcessTranscript()}
                disabled={isParsing || !transcript.trim()}
                className="px-5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-xl shadow-sm hover:shadow transition-all flex items-center gap-2 cursor-pointer"
              >
                {isParsing ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Interpreting...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    Parse & Review
                  </>
                )}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => {
                  setStep('listen');
                  setErrorMsg(null);
                  setInfoMsg(null);
                }}
                className="px-4 py-2 text-xs font-medium text-slate-700 hover:text-slate-900 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer"
              >
                Re-record Voice
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleClose}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-800 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmTransaction}
                  disabled={isSaving || amount <= 0}
                  className="px-5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-xl shadow-sm hover:shadow transition-all flex items-center gap-2 cursor-pointer"
                >
                  {isSaving ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      Recording...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Confirm & Save
                    </>
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
