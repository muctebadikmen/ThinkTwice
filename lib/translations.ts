// ponytail: flat key→{en,tr} dict, zero deps. Add next-intl when 3+ languages.
const t: Record<string, { en: string; tr: string }> = {
  // ── Main page ──
  'Think Twice':                    { en: 'Think Twice', tr: 'Think Twice' },
  heroDesc:                         { en: "Can't decide? AI agents will research and debate each option, then a judge will tell you which wins — with solid reasoning.", tr: "Karar veremiyor musun? Yapay zeka ajanları her seçeneği araştırıp tartışacak, sonra bir yargıç hangisinin kazandığını söyleyecek — sağlam gerekçelerle." },
  'Smart Mode':                     { en: 'Smart Mode', tr: 'Akıllı Mod' },
  'Manual Mode':                    { en: 'Manual Mode', tr: 'Manuel Mod' },
  'Describe your decision':         { en: 'Describe your decision', tr: 'Kararını açıkla' },
  smartPlaceholder:                 { en: "e.g. I'm a CS student trying to decide between going to grad school, getting a job at a startup, or freelancing. I have $20k in savings, no debt, and I value work-life balance. I'm based in Berlin and would prefer to stay in Europe.", tr: "örn. Bilgisayar mühendisliği öğrencisiyim; yüksek lisans, startup'ta iş veya freelance çalışma arasında karar vermeye çalışıyorum. 20 bin dolar birikimim var, borcum yok, iş-yaşam dengesine önem veriyorum. Berlin'deyim, Avrupa'da kalmayı tercih ederim." },
  smartHint:                        { en: "Just explain what you're deciding. AI will figure out the options, context, and assign expert advocates.", tr: "Sadece neye karar vermeye çalıştığını açıkla. Yapay zeka seçenekleri, bağlamı belirleyip uzman avukatlar atayacak." },
  'Options & Expert Advocates':     { en: 'Options & Expert Advocates', tr: 'Seçenekler ve Uzman Avukatlar' },
  'Edit any field before starting': { en: 'Edit any field before starting', tr: 'Başlamadan önce alanları düzenleyebilirsin' },
  Expert:                           { en: 'Expert', tr: 'Uzman' },
  'Extracted Context':              { en: 'Extracted Context', tr: 'Çıkarılan Bağlam' },
  Language:                         { en: 'Language', tr: 'Dil' },
  Model:                            { en: 'Model', tr: 'Model' },
  'Loading models…':               { en: 'Loading models…', tr: 'Modeller yükleniyor…' },
  'Custom model…':                  { en: 'Custom model…', tr: 'Özel model…' },
  customPlaceholder:                { en: 'openai/gpt-5.2 \u2022 google/gemini-3-pro \u2022 meta-llama/llama-4 \u2026', tr: 'openai/gpt-5.2 \u2022 google/gemini-3-pro \u2022 meta-llama/llama-4 \u2026' },
  'Auto-pilot mode':                { en: 'Auto-pilot mode', tr: 'Oto-pilot modu' },
  autoPilotDesc:                    { en: 'Skip all mid-debate questions \u2014 the judge will never pause to ask you for clarification', tr: 'Tartışma sırasında soru sorma \u2014 yargıç hiç duraklamadan kararını verir' },
  'Analyze & Set Up Debate':        { en: 'Analyze & Set Up Debate', tr: 'Analiz Et ve Tartışmayı Başlat' },
  'Analyzing your decision...':     { en: 'Analyzing your decision...', tr: 'Kararın analiz ediliyor...' },
  'Re-analyze':                     { en: 'Re-analyze', tr: 'Tekrar Analiz Et' },
  'Start Debate with Experts \u2192':  { en: 'Start Debate with Experts \u2192', tr: 'Uzmanlarla Tartışmayı Başlat \u2192' },
  'Start Debate \u2192':               { en: 'Start Debate \u2192', tr: 'Tartışmayı Başlat \u2192' },
  'Starting debate...':             { en: 'Starting debate...', tr: 'Tartışma başlıyor...' },
  'How it works':                   { en: 'How it works', tr: 'Nasıl çalışır' },
  step1Smart:                       { en: 'Describe your decision — AI figures out options & assigns expert advocates', tr: 'Kararını açıkla — YZ seçenekleri belirler ve uzman avukatlar atar' },
  step1Manual:                      { en: 'A judge asks a focused question to compare your options', tr: 'Bir yargıç seçeneklerini karşılaştırmak için odaklı bir soru sorar' },
  step2:                            { en: 'Expert advocates research & argue their case with real evidence', tr: 'Uzman avukatlar gerçek kanıtlarla araştırır ve davalarını savunur' },
  step3:                            { en: 'Judge evaluates, asks follow-ups, then picks a winner. Not satisfied? Continue the debate.', tr: 'Yargıç değerlendirir, takip soruları sorar, kazananı seçer. Memnun değil misin? Tartışmayı sürdür.' },
  'View past debates':             { en: 'View past debates', tr: 'Geçmiş tartışmaları gör' },
  'Step 1':                        { en: 'Step 1', tr: 'Adım 1' },
  'Step 2':                        { en: 'Step 2', tr: 'Adım 2' },
  'Step 3':                        { en: 'Step 3', tr: 'Adım 3' },
  'Add another option':            { en: '+ Add another option', tr: '+ Seçenek ekle' },
  'Options to compare':            { en: 'Options to compare', tr: 'Karşılaştırılacak seçenekler' },
  Context:                          { en: 'Context', tr: 'Bağlam' },
  optional:                         { en: 'optional', tr: 'isteğe bağlı' },
  contextPlaceholder:               { en: "e.g. I'm a developer on a tight budget who prioritizes battery life for travel...", tr: "örn. Seyahat için pil ömrüne öncelik veren, bütçesi kısıtlı bir yazılımcıyım..." },

  // ── Error messages ──
  errorNeedMoreDetail:              { en: 'Please describe your decision in more detail.', tr: 'Lütfen kararını daha detaylı açıkla.' },
  errorAnalyzeFirst:                { en: 'Please analyze your decision first.', tr: 'Lütfen önce kararını analiz et.' },
  errorNeedTwoOptions:              { en: 'Please fill in at least 2 options.', tr: 'Lütfen en az 2 seçenek gir.' },
  errorStartFailed:                 { en: 'Failed to start debate', tr: 'Tartışma başlatılamadı' },
  errorAnalyzeFailed:               { en: 'Failed to analyze your decision', tr: 'Kararın analiz edilemedi' },
  errorContinueFailed:              { en: 'Failed to continue debate', tr: 'Tartışma sürdürülemedi' },

  // ── History page ──
  'Past Debates':                   { en: 'Past Debates', tr: 'Geçmiş Tartışmalar' },
  'No debates yet. Start your first one!': { en: 'No debates yet. Start your first one!', tr: 'Henüz tartışma yok. İlkini başlat!' },
  Back:                             { en: '← Back', tr: '← Geri' },
  'Back to history':                { en: '← Back to history', tr: '← Geçmiş tartışmalara dön' },
  'Clear all':                      { en: 'Clear all', tr: 'Hepsini sil' },
  'Start a debate':                 { en: 'Start a debate', tr: 'Tartışma başlat' },
  'Start a new debate':             { en: 'Start a new debate', tr: 'Yeni tartışma başlat' },
  Delete:                           { en: 'Delete', tr: 'Sil' },
  'View full debate →':             { en: 'View full debate →', tr: 'Tartışmanın tamamını gör →' },
  'saved locally':                  { en: 'saved locally', tr: 'yerel olarak kaydedildi' },
  debatesSaved:                     { en: 'debate', tr: 'tartışma' }, // plural handled in code
  roundsLabel:                      { en: 'round', tr: 'tur' },       // plural handled in code
  'Just now':                       { en: 'Just now', tr: 'Az önce' },
  'm ago':                          { en: 'm ago', tr: 'dk önce' },
  'h ago':                          { en: 'h ago', tr: 's önce' },
  'd ago':                          { en: 'd ago', tr: 'g önce' },

  // ── History detail page ──
  'Debate not found':               { en: 'Debate not found', tr: 'Tartışma bulunamadı' },
  'Debate Rounds':                  { en: 'Debate Rounds', tr: 'Tartışma Turları' },
  "Judge's Question":               { en: "Judge's Question", tr: 'Yargıcın Sorusu' },
  'User Clarification':             { en: 'User Clarification', tr: 'Kullanıcı Açıklaması' },
  "Judge's Verdict":                { en: "Judge's Verdict", tr: 'Yargıcın Kararı' },
  Advocate:                         { en: 'Advocate', tr: 'Avukat' },
  rounds:                           { en: 'rounds', tr: 'tur' },

  // ── Debate page (live) ──
  'Debate complete':                { en: 'Debate complete', tr: 'Tartışma tamamlandı' },
  'Judge is delivering the verdict': { en: 'Judge is delivering the verdict', tr: 'Yargıç kararını veriyor' },

  // ── Debate components ──
  'Searching the web and forming response…': { en: 'Searching the web and forming response…', tr: 'Web\'de arama yapılıyor, yanıt hazırlanıyor…' },
  "Waiting for judge's question…":  { en: "Waiting for judge's question…", tr: 'Yargıcın sorusu bekleniyor…' },
  'Response submitted':             { en: 'Response submitted', tr: 'Yanıt gönderildi' },
  'Response was not captured for this round.': { en: 'Response was not captured for this round.', tr: 'Bu tur için yanıt alınamadı.' },
  'Round complete':                 { en: 'Round complete', tr: 'Tur tamamlandı' },
  'Judge is reviewing all responses…': { en: 'Judge is reviewing all responses…', tr: 'Yargıç tüm yanıtları inceliyor…' },
  'Judge is analyzing the options…': { en: 'Judge is analyzing the options…', tr: 'Yargıç seçenekleri analiz ediyor…' },
  'Reading all arguments and forming verdict…': { en: 'Reading all arguments and forming verdict…', tr: 'Tüm argümanlar okunuyor, karar oluşturuluyor…' },
  'Debate paused — waiting for your response': { en: 'Debate paused — waiting for your response', tr: 'Tartışma durakladı — yanıtınız bekleniyor' },
  'Judge is delivering the final verdict': { en: 'Judge is delivering the final verdict', tr: 'Yargıç nihai kararını veriyor' },
  'Judge asked:':                   { en: 'Judge asked:', tr: 'Yargıç sordu:' },
  'Submit & Continue Debate':       { en: 'Submit & Continue Debate', tr: 'Gönder ve Tartışmayı Sürdür' },
  Submitted:                        { en: 'Submitted', tr: 'Gönderildi' },
  'Type your answer here...':       { en: 'Type your answer here...', tr: 'Yanıtınızı buraya yazın...' },
  Enter:                            { en: 'Enter', tr: 'Enter' },
  challengePlaceholder:             { en: "e.g. You didn't consider the long-term maintenance costs, and the winner actually has terrible customer support based on recent reviews...", tr: "örn. Uzun vadeli bakım maliyetlerini hesaba katmadınız ve kazanan seçeneğin son incelemelere göre berbat bir müşteri desteği var..." },
  challengeDescription:             { en: "If you think the debate missed something or the reasoning was flawed, explain what was wrong. The debate will continue with additional rounds addressing your concerns.", tr: "Tartışmanın bir şeyi kaçırdığını veya mantığın hatalı olduğunu düşünüyorsan, neyin yanlış olduğunu açıkla. Tartışma endişelerini ele alan ek turlarla devam edecek." },

  // ── Debate component dynamic labels ──
  Round:                            { en: 'Round', tr: 'Tur' },
  'Formulating question…':         { en: 'Formulating question…', tr: 'Soru oluşturuluyor…' },
  "Judge's Notes":                  { en: "Judge's Notes", tr: 'Yargıcın Notları' },
  'Evaluating…':                    { en: 'Evaluating…', tr: 'Değerlendiriliyor…' },
  'Continuing to next round':       { en: 'Continuing to next round', tr: 'Sonraki tura geçiliyor' },
  'Deliberating…':                  { en: 'Deliberating…', tr: 'Karar veriliyor…' },
  'Judge is formulating question':  { en: 'Judge is formulating question for Round {round}/{max}', tr: 'Yargıç Tur {round}/{max} için soru oluşturuyor' },
  'advocates researching':          { en: '{count} advocate{count,plural,s} researching & responding', tr: '{count} avukat araştırıyor ve yanıtlıyor' },
  'Judge is evaluating round':      { en: 'Judge is evaluating Round {round} responses', tr: 'Yargıç Tur {round} yanıtlarını değerlendiriyor' },
  'Your Clarification':             { en: 'Your Clarification', tr: 'Açıklamanız' },
  'Judge Needs Your Input':         { en: 'Judge Needs Your Input', tr: 'Yargıcın Görüşüne İhtiyacı Var' },
  'Debate paused':                  { en: 'Debate paused', tr: 'Tartışma durakladı' },
  'Press Cmd+Enter to submit':      { en: 'Press Cmd+Enter to submit', tr: 'Göndermek için Cmd+Enter' },
  'Press Cmd+Enter to continue':    { en: 'Press Cmd+Enter to continue', tr: 'Devam etmek için Cmd+Enter' },
  'Submitting…':                    { en: 'Submitting…', tr: 'Gönderiliyor…' },
  'Not satisfied? Challenge the verdict': { en: 'Not satisfied? Challenge the verdict', tr: 'Memnun değil misin? Karara itiraz et' },
  'Continuing debate…':             { en: 'Continuing debate…', tr: 'Tartışma sürdürülüyor…' },
  'Continue Debate →':              { en: 'Continue Debate →', tr: 'Tartışmayı Sürdür →' },

  // ── Debate top bar phase labels ──
  'Starting…':                       { en: 'Starting…', tr: 'Başlıyor…' },
  'Phase round judge question':       { en: 'Round {round}/{max} — Judge is asking a question', tr: 'Tur {round}/{max} — Yargıç soru soruyor' },
  'Phase round advocates':            { en: 'Round {round}/{max} — Advocates are responding', tr: 'Tur {round}/{max} — Avukatlar yanıtlıyor' },
  'Phase round evaluating':           { en: 'Round {round}/{max} — Judge is evaluating', tr: 'Tur {round}/{max} — Yargıç değerlendiriyor' },
  'Phase round waiting':              { en: 'Round {round}/{max} — Waiting for your input', tr: 'Tur {round}/{max} — Yanıtınız bekleniyor' },
};

export type TKey = keyof typeof t;

export function translate(key: TKey, lang: string): string {
  const entry = t[key];
  if (!entry) return key;
  const l = lang.toLowerCase();
  if (l === 'tr' || l === 'turkish' || l === 'türkçe' || l === 'turkce') return entry.tr;
  return entry.en;
}
