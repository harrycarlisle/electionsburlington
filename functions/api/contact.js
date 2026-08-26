import { handleContact } from '../../lib/contact.js';

export async function onRequest(context) {
  return handleContact(context.request, context.env);
}
