// // components/AnimatedPage.tsx
// import React from 'react';
// import { motion, AnimatePresence } from 'framer-motion';

// interface AnimatedPageProps {
//   children: React.ReactNode;
//   direction?: 'left' | 'right' | 'top' | 'bottom'; // Direction of the slide animation
//   duration?: number; // Animation duration in seconds
//   scale?: boolean; // Whether to include a scale effect
//   staggerChildren?: boolean; // Whether to stagger child animations
// }

// // Define animation variants with dynamic direction
// const getPageVariants = (
//   direction: 'left' | 'right' | 'top' | 'bottom' = 'top',
//   scale: boolean = false
// ) => ({
//   initial: {
//     opacity: 0,
//     x: direction === 'left' ? 100 : direction === 'right' ? -100 : 0,
//     y: direction === 'top' ? 50 : direction === 'bottom' ? -50 : 0,
//     scale: scale ? 0.95 : 1,
//   },
//   in: {
//     opacity: 1,
//     x: 0,
//     y: 0,
//     scale: 1,
//     transition: {
//       type: 'tween',
//       ease: 'anticipate',
//     },
//   },
//   out: {
//     opacity: 0,
//     x: direction === 'left' ? -100 : direction === 'right' ? 100 : 0,
//     y: direction === 'top' ? -50 : direction === 'bottom' ? 50 : 0,
//     scale: scale ? 0.95 : 1,
//     transition: {
//       type: 'tween',
//       ease: 'anticipate',
//     },
//   },
// });

// // Staggered animation for child elements
// const containerVariants = {
//   in: {
//     transition: {
//       staggerChildren: 0.1, // Delay between each child animation
//     },
//   },
//   out: {
//     transition: {
//       staggerChildren: 0.1,
//     },
//   },
// };

// // Child animation variants
// const childVariants = {
//   initial: {
//     opacity: 0,
//     y: 20,
//   },
//   in: {
//     opacity: 1,
//     y: 0,
//     transition: {
//       type: 'tween',
//       ease: 'easeOut',
//       duration: 0.3,
//     },
//   },
//   out: {
//     opacity: 0,
//     y: -20,
//     transition: {
//       type: 'tween',
//       ease: 'easeIn',
//       duration: 0.3,
//     },
//   },
// };

// // Error Boundary Component
// interface ErrorBoundaryState {
//   hasError: boolean;
//   error: Error | null;
// }

// class ErrorBoundary extends React.Component<
//   { children: React.ReactNode },
//   ErrorBoundaryState
// > {
//   state: ErrorBoundaryState = { hasError: false, error: null };

//   static getDerivedStateFromError(error: Error) {
//     return { hasError: true, error };
//   }

//   componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
//     console.error('ErrorBoundary in AnimatedPage caught an error:', error, errorInfo);
//   }

//   render() {
//     if (this.state.hasError) {
//       return (
//         <div className="h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
//           <p className="text-red-500">
//             Something went wrong: {this.state.error?.message}
//           </p>
//         </div>
//       );
//     }
//     return this.props.children;
//   }
// }

// const AnimatedPage: React.FC<AnimatedPageProps> = ({
//   children,
//   direction = 'top',
//   duration = 0.5,
//   scale = false,
//   staggerChildren = false,
// }) => {
//   const pageVariants = getPageVariants(direction, scale);
//   const pageTransition = {
//     type: 'tween',
//     ease: 'anticipate',
//     duration,
//   };

//   return (
//     <ErrorBoundary>
//       <AnimatePresence mode="wait">
//         <motion.div
//           initial="initial"
//           animate="in"
//           exit="out"
//           variants={staggerChildren ? containerVariants : pageVariants}
//           transition={pageTransition}
//           className="w-full h-full"
//         >
//           {staggerChildren ? (
//             <motion.div variants={childVariants}>{children}</motion.div>
//           ) : (
//             children
//           )}
//         </motion.div>
//       </AnimatePresence>
//     </ErrorBoundary>
//   );
// };

// export default AnimatedPage;


// src/components/AnimatedPage.tsx
import React, { ReactNode } from 'react';
import { motion } from 'framer-motion';

interface AnimatedPageProps {
  children: ReactNode;
}

const AnimatedPage: React.FC<AnimatedPageProps> = ({ children }) => {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
    >
      {children}
    </motion.div>
  );
};

export default AnimatedPage;