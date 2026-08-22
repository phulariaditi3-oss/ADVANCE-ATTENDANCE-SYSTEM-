import { motion } from 'framer-motion';
import logo from '../assets/logo.svg';
import { INSTITUTE_NAME, INSTITUTE_LOCATION, APP_NAME } from '../lib/constants';

export default function SplashScreen({ onFinish }) {
  return (
    <motion.div
      initial={{ opacity: 1 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.5, ease: 'easeInOut' }}
      onAnimationComplete={onFinish}
      className="fixed inset-0 z-[200] bg-gradient-hero flex flex-col items-center justify-center p-6 text-white text-center select-none"
    >
      {/* Soft Ambient Blobs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-primary-500/10 blur-[100px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full bg-white/20 blur-[120px] pointer-events-none" />

      {/* Logo Container (Neumorphic) */}
      <motion.div
        initial={{ scale: 0.4, opacity: 0 }}
        animate={{ scale: [0.4, 1.05, 1], opacity: 1 }}
        transition={{ duration: 1.1, ease: [0.34, 1.56, 0.64, 1] }}
        className="relative w-36 h-36 sm:w-44 sm:h-44 mb-10"
      >
        <div className="w-full h-full rounded-[40px] bg-surface-50 border-2 border-white/80 p-5 flex items-center justify-center shadow-[10px_10px_30px_rgba(175,100,223,0.3),-10px_-10px_30px_rgba(255,255,255,0.8)]">
          <img
            src={logo}
            alt={INSTITUTE_NAME}
            className="w-full h-full object-contain relative z-10 filter drop-shadow-xl"
          />
        </div>
      </motion.div>

      {/* Title */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.55, duration: 0.7 }}
        className="space-y-3 max-w-md"
      >
        <span className="px-4 py-1.5 rounded-full bg-white/30 text-surface-900 border border-white/50 text-[10px] font-black uppercase tracking-widest shadow-sm">
          MSBTE Affiliated Institute
        </span>
        <h1 className="text-3xl sm:text-4xl font-black text-surface-900 tracking-tight mt-4">
          {INSTITUTE_NAME}
        </h1>
        <p className="text-surface-700 text-sm font-bold tracking-wide">
          {INSTITUTE_LOCATION}
        </p>
        <p className="text-xs text-surface-500 pt-2 font-black uppercase tracking-widest">
          {APP_NAME}
        </p>
      </motion.div>

      {/* Loading Bar */}
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: '160px' }}
        transition={{ delay: 0.35, duration: 1.5, ease: 'easeInOut' }}
        className="h-1.5 bg-gradient-to-r from-[#4F46E5] to-[#4338CA] rounded-full mt-12 shadow-[0_0_10px_rgba(79,70,229,0.5)]"
      />
    </motion.div>
  );
}
