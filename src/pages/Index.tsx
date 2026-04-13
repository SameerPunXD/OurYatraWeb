import Navbar from "@/components/landing/Navbar";
import HeroSection from "@/components/landing/HeroSection";
import ServicesSection from "@/components/landing/ServicesSection";
import HowItWorksSection from "@/components/landing/HowItWorksSection";
import DriverSection from "@/components/landing/DriverSection";
import TrustSection from "@/components/landing/TrustSection";
import CTASection from "@/components/landing/CTASection";
import Footer from "@/components/landing/Footer";

const Index = () => {
  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      <Navbar />
      <HeroSection />
      <ServicesSection />
      <HowItWorksSection />
      <DriverSection />
      <TrustSection />
      <CTASection />
      <Footer />
    </div>
  );
};

export default Index;
