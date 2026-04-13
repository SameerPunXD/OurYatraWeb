import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";

const CTASection = () => {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  const { toast } = useToast();
  const navigate = useNavigate();

  return (
    <section className="py-20 md:py-24 bg-primary">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-10" ref={ref}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center space-y-6"
        >
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight text-primary-foreground">
            Ready to get started?
          </h2>
          <p className="text-primary-foreground/80 text-base md:text-lg max-w-md mx-auto">
            Download the app and take your first ride today.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-3">
            <Button
              size="lg"
              className="rounded-lg font-semibold px-10 h-14 text-base bg-background text-foreground hover:bg-background/90 group"
              onClick={() => toast({ title: "Coming soon", description: "Download App is coming soon." })}
            >
              Download App
              <ArrowRight className="w-4 h-4 ml-1 transition-transform group-hover:translate-x-1" />
            </Button>
            <Button
              size="lg"
              className="rounded-lg font-semibold px-10 h-14 text-base bg-primary text-primary-foreground border border-white/60 hover:bg-primary/90"
              onClick={() => navigate("/signup?role=driver")}
            >
              Earn with Us
            </Button>
          </div>
          <p className="text-xs text-primary-foreground/80">Download App: Coming soon</p>
        </motion.div>
      </div>
    </section>
  );
};

export default CTASection;
