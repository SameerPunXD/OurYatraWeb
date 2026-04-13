import { Mail, Phone, MessageCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const faqs = [
  { q: "How do I book a ride?", a: "Go to 'Book Ride' from the sidebar or dashboard, enter your pickup and drop-off locations, choose a vehicle type, and tap 'Book Now'. We'll match you with the nearest driver." },
  { q: "How do I cancel a ride?", a: "You can cancel a ride while it's still pending by tapping the 'Cancel' button on the ride card. Once a driver has accepted, cancellation may incur a fee." },
  { q: "How does parcel delivery work?", a: "Go to 'Send Parcel', fill in pickup/drop-off details, recipient info, and package description. A driver will pick up and deliver your parcel." },
  { q: "What payment methods are accepted?", a: "Currently OurYatra supports cash payments. Digital payment integration is coming soon." },
  { q: "How do I update my profile?", a: "Go to the 'Profile' section in the sidebar to update your name, phone number, profile photo, and emergency contacts." },
  { q: "How do subscriptions work?", a: "Visit the 'Subscription' page to view available plans. Subscriptions offer benefits like discounted fares and priority matching." },
];

const SupportPage = () => {
  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Help & Support</h2>
        <p className="text-muted-foreground">Get help with your OurYatra account</p>
      </div>

      {/* Contact */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-5 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Phone className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Call Us</p>
              <p className="text-sm text-muted-foreground">+977 01-XXXXXXX</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Mail className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Email</p>
              <p className="text-sm text-muted-foreground">support@ouryatra.com</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <MessageCircle className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Live Chat</p>
              <p className="text-sm text-muted-foreground">Coming soon</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* FAQ */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Frequently Asked Questions</CardTitle>
        </CardHeader>
        <CardContent>
          <Accordion type="single" collapsible className="w-full">
            {faqs.map((faq, i) => (
              <AccordionItem key={i} value={`faq-${i}`}>
                <AccordionTrigger className="text-left text-sm">{faq.q}</AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground">{faq.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </CardContent>
      </Card>
    </div>
  );
};

export default SupportPage;
