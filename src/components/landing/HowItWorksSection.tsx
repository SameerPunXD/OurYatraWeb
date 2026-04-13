import { motion, useInView, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import stepRequest from "@/assets/step-request.png";
import stepMatch from "@/assets/step-match.png";
import stepTrack from "@/assets/step-track.png";
import stepArrive from "@/assets/step-arrive.png";

const steps = [
  { num: "01", title: "Request", description: "Enter your pickup & destination in seconds", image: stepRequest },
  { num: "02", title: "Match", description: "A nearby driver accepts your ride instantly", image: stepMatch },
  { num: "03", title: "Track", description: "Watch your ride arrive in real-time on the map", image: stepTrack },
  { num: "04", title: "Arrive", description: "Get there safely, rate your driver & go", image: stepArrive },
];

const HowItWorksSection = () => {
  const wrapperRef = useRef(null);
  const inView = useInView(wrapperRef, { once: true, margin: "-60px" });
  const { scrollYProgress } = useScroll({
    target: wrapperRef,
    offset: ["start 0.7", "end 0.35"],
  });

  const roadWidth = useTransform(scrollYProgress, [0, 0.3, 1], ["0%", "5%", "100%"]);

  return (
    <section ref={wrapperRef} className="py-16 md:py-24 bg-background overflow-x-clip">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5 }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight text-foreground">
            How It Works
          </h2>
          <p className="text-muted-foreground text-base mt-3 max-w-md mx-auto">
            Get a ride in four simple steps.
          </p>
        </motion.div>

        {/* Desktop: Horizontal journey path */}
        <div className="hidden md:block relative">
          {/* Road/journey path */}
          <div className="absolute top-[72px] left-[8%] right-[8%] h-1 bg-border rounded-full z-0">
            <motion.div
              className="h-full bg-primary rounded-full origin-left"
              style={{ width: roadWidth }}
            />
            {/* Road dashes */}
            <div className="absolute inset-0 flex items-center justify-between px-4">
              {[...Array(20)].map((_, i) => (
                <div key={i} className="w-3 h-0.5 bg-background/60 rounded-full" />
              ))}
            </div>
          </div>

          <div className="grid grid-cols-4 gap-8 lg:gap-12">
            {steps.map((step, i) => (
              <motion.div
                key={step.num}
                initial={{ opacity: 0, y: 40 }}
                animate={inView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.6, delay: 0.2 + i * 0.18, ease: [0.22, 1, 0.36, 1] }}
                className="text-center relative z-10"
              >
                {/* Illustration */}
                <motion.div
                  className="w-36 h-36 mx-auto mb-4 relative"
                  whileHover={{ scale: 1.05, y: -4 }}
                  transition={{ type: "spring", stiffness: 300 }}
                >
                  <img
                    src={step.image}
                    alt={step.title}
                    className="w-full h-full object-contain rounded-2xl"
                    loading="lazy"
                  />
                </motion.div>

                {/* Step number badge */}
                <motion.div
                  className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold mx-auto mb-3 shadow-md"
                  initial={{ scale: 0 }}
                  animate={inView ? { scale: 1 } : {}}
                  transition={{ duration: 0.4, delay: 0.4 + i * 0.18, type: "spring", stiffness: 200 }}
                >
                  {i + 1}
                </motion.div>

                <h4 className="text-lg font-bold text-foreground mb-1">{step.title}</h4>
                <p className="text-sm text-muted-foreground leading-relaxed max-w-[200px] mx-auto">
                  {step.description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Mobile: Vertical timeline with illustrations */}
        <div className="md:hidden relative">
          <div className="absolute left-[39px] top-0 bottom-0 w-0.5 bg-border z-0" />
          <motion.div
            className="absolute left-[39px] top-0 w-0.5 bg-primary origin-top z-[1]"
            initial={{ scaleY: 0 }}
            animate={inView ? { scaleY: 1 } : {}}
            transition={{ duration: 2.5, ease: [0.22, 1, 0.36, 1], delay: 0.3 }}
            style={{ height: "100%" }}
          />

          <div className="space-y-8">
            {steps.map((step, i) => (
              <motion.div
                key={step.num}
                initial={{ opacity: 0, x: -20 }}
                animate={inView ? { opacity: 1, x: 0 } : {}}
                transition={{ duration: 0.5, delay: 0.2 + i * 0.15 }}
                className="flex items-start gap-4 relative"
              >
                {/* Timeline node */}
                <div className="shrink-0 relative z-10">
                  <div className="w-20 h-20 rounded-xl overflow-hidden bg-secondary">
                    <img src={step.image} alt={step.title} className="w-full h-full object-contain" loading="lazy" />
                  </div>
                </div>

                {/* Content */}
                <div className="pt-2">
                  <span className="text-xs font-bold text-primary">STEP {i + 1}</span>
                  <h4 className="text-base font-bold text-foreground mt-0.5">{step.title}</h4>
                  <p className="text-sm text-muted-foreground leading-relaxed mt-1">{step.description}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default HowItWorksSection;
