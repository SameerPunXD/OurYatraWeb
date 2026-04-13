
-- Tighten chat_messages insert to require sender_id = auth.uid() (already done)
-- Tighten notifications insert - only allow inserting for own user or via service role
DROP POLICY "Authenticated can insert notifications" ON public.notifications;
CREATE POLICY "Users can insert own notifications" ON public.notifications FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
