import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { Eye, Shield, Phone, History } from "lucide-react";

const features = [
  { icon: Eye, label: "Live Tracking", description: "Real-time GPS on every ride" },
  { icon: Shield, label: "Verified Drivers", description: "Background-checked partners" },
  { icon: Phone, label: "Emergency SOS", description: "One-tap emergency access" },
  { icon: History, label: "Ride History", description: "Full trip transparency" },
];

const TrustSection = () => {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <section id="safety" className="py-16 md:py-20 bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5 }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight text-foreground">
            Your Safety Matters
          </h2>
          <p className="text-muted-foreground text-base mt-3">
            Every feature designed to keep you safe.
          </p>
        </motion.div>

        <div ref={ref} className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-6">
          {features.map((f, i) => (
            <motion.div
              key={f.label}
              initial={{ opacity: 0, y: 24 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: i * 0.12, ease: [0.22, 1, 0.36, 1] }}
              className="text-center group"
            >
              {/* Icon with floating animation and pulse ring */}
              <div className="relative w-16 h-16 mx-auto mb-4">
                <motion.div
                  className="w-16 h-16 rounded-2xl bg-primary/5 flex items-center justify-center relative z-10"
                  animate={inView ? { y: [0, -5, 0] } : {}}
                  transition={{
                    duration: 3,
                    delay: i * 0.3,
                    repeat: Infinity,
                    repeatType: "loop",
                    ease: "easeInOut",
                  }}
                >
                  <f.icon className="w-7 h-7 text-primary" />
                </motion.div>
                {/* Pulse ring on hover */}
                <div className="absolute inset-0 rounded-2xl border border-primary/10 opacity-0 group-hover:opacity-100 group-hover:scale-125 transition-all duration-500" />
              </div>
              <h4 className="text-base font-bold text-foreground mb-1">{f.label}</h4>
              <p className="text-sm text-muted-foreground leading-relaxed">{f.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default TrustSection;
