import { motion } from 'framer-motion';
import logoMark from '../../assets/favicon.png';
import './BioLoader.css';

export default function BioLoader({ size = 48, text = '' }) {
  return (
    <div className="bioloader-wrap">
      <div className="bioloader-ring-outer">
        <motion.div
          className="bioloader-ring"
          animate={{ rotate: 360 }}
          transition={{ duration: 1.6, repeat: Infinity, ease: 'linear' }}
        />
        <motion.div
          className="bioloader-ring bioloader-ring-inner"
          animate={{ rotate: -360 }}
          transition={{ duration: 2.4, repeat: Infinity, ease: 'linear' }}
        />
        <motion.img
          src={logoMark}
          alt="Loading"
          className="bioloader-icon"
          style={{ width: size * 0.52, height: size * 0.52 }}
          animate={{ scale: [1, 1.08, 1] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>
      {text && <p className="bioloader-text">{text}</p>}
    </div>
  );
}

export function BioLoaderPage({ text = 'Loading…' }) {
  return (
    <div className="bioloader-page">
      <BioLoader size={56} text={text} />
    </div>
  );
}

export function BioLoaderInline() {
  return (
    <motion.img
      src={logoMark}
      alt=""
      className="bioloader-inline"
      animate={{ opacity: [0.5, 1, 0.5], scale: [0.9, 1, 0.9] }}
      transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
    />
  );
}
