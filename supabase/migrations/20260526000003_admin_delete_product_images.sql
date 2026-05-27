-- Allow admins to delete any member's product image row.
-- Regular members can already delete their own uploads via the existing
-- "members delete own uploads" policy on storage.objects, but no policy
-- existed on the product_images table for admin cleanup of mismatched photos.

CREATE POLICY "admins delete any product image"
  ON public.product_images FOR DELETE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));
