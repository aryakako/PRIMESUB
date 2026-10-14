# PrimeSub Studio Pro - Private Beta

## Apne computer par chalana
1. `.env.example` ko copy karke `.env` banayein, aur usme apni Groq key aur access codes likhein.
2. `npm i` phir `npm start`
3. Browser me `localhost:3000` (landing page) ya seedha `localhost:3000/app` (editor), aur Ctrl+Shift+R.

## Beta ke liye online daalna (Render ya Railway jaisi jagah)
1. Project ko GitHub par daalein (`.env` kabhi nahi, wo `.gitignore` me hai).
2. Render par "New Web Service" -> apna repo chunein.
   - Build command: `npm install`
   - Start command: `npm start`
3. "Environment" me yeh values daalein: `GROQ_API_KEY`, `ACCESS_CODES`, `ADMIN_KEY`, `CODE_MINUTES`, `MAX_VIDEO_MINUTES`, `USD_INR`.
4. Deploy ke baad milne wale link par jaake test karein, phir apna domain jod sakte hain.

Dhyan rakhein:
- Free plans par server kuch der baad so jata hai, aur disk saaf ho sakta hai (tab `usage.json` ke minutes reset ho jayenge). Sirf thode testers ke beta ke liye chalega; asli launch ke liye database chahiye.
- Groq console me monthly kharche ki limit aur alert zaroor lagayein.
- Plan ki sharten aur upload limits unki site par ek baar dekh lein.

## Beta me kisne kitna use kiya
`https://aapka-link/api/admin/usage?key=ADMIN_KEY` kholein.
Kali window (server logs) me har video ke baad `[cost]` line aati hai.

## Abhi nahi hai (agla kaam)
Google login, asli minute-credits ka database, Razorpay payment, privacy/terms pages.

## Editor features (v0.3)
- Waveform timeline: word ke kinare kheench kar start/end badlein, beech se kheench kar poora word khisakayein. Zoom slider se bada karein.
- Karaoke Fill, Pop-in Bounce, Smart Highlight (numbers aur power words) - Settings ke toggles.
- Brand Kit tab: apne colours aur font (.ttf/.otf). Font sirf aapke browser me save hota hai.
- Chunk ke saamne S1/S2 button se speaker ka alag rang (manual).

## v0.4
- Draft auto-save: kaam har 3 second me aapke browser me save hota hai. Wahi video dobara daalne par "Restore" ka option aata hai (dobara transcribe nahi hota, minute nahi katte). Yeh sirf usi browser/computer par rehta hai (cloud save login ke baad).
- Review mode: left side me "Review mode" button se peele (shak wale) words ek-ek karke sunkar theek karein.
- Post Text: header ke "Post Text" button se Reels ke title, caption aur hashtags.

## v0.5 (UI polish)
- Poora interface professional English me (captions ki bhasha pehle jaisi: Hindi/Hinglish/etc.).
- Caption list ka naya layout (index, time, text aur speaker button seedhe aligned), "Review" badge, empty states.
- Header ko left (brand + minutes), center (status), right (actions) me baanta gaya.
- Purana nakli pricing/promo popup hata diya.

## v0.5 (UI polish)
- Poora interface professional English me; Hinglish sirf captions ke andar.
- Caption list: number badge, time chip, review flag, aur abhi bol rahi line highlight hoti hai (play ke saath scroll bhi).
- Nakli pricing popup aur code me likhe promo codes hata diye (payment aane par server-side aayenge).

## v0.6 (landing page + feedback)
- `/` par landing page, `/app` par editor.
- Feedback button aur "Request access" link `.env` se chalte hain: `FEEDBACK_URL`, `ACCESS_REQUEST_URL`, `CONTACT_EMAIL`. Hatana ho toh bas value khali kar dein aur Render me redeploy/restart karein (code nahi badalna).
- Landing page par "video aapke browser me rehti hai, sirf audio jati hai" likha hai. FFmpeg server export aane par is line ko zaroor badlein.

## v0.7
- Spelling fix: jo words AI se theek nahi hote the (aksar video ka aakhri hissa) ab dobara bheje jaate hain, aur phir bhi na hon toh review ke liye flag hote hain. Common galat spellings ki built-in list bhi judi.
- Projects button: pichle saved projects ki list. Dobara kholne ke liye wahi video file chunni padti hai (video browser me store nahi hoti).
