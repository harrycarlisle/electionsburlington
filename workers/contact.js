import { handleContact } from '../lib/contact.js';

export default {
  async fetch(request, env) {
    return handleContact(request, env);
  }
};
