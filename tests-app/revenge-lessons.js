/* Revenge mode data.
   REVENGE_SEED: misses Sihan sent on WhatsApp (19 Oct 2026, JSS PYQ Mock, 65/90), so they load
   on every device even when that attempt is not stored on it. i = 0-based question index.
   REVENGE_LESSONS["<mockId>:<index>"]: learn-it-from-scratch layer on top of the deep explanation.
     s = from scratch (paragraphs), f = why your pick looked right, h = memory hook, k = key note (disputed keys). */
window.REVENGE_SEED = [
  { m: "jss-pyq", i: 24, p: "c" }, { m: "jss-pyq", i: 26, p: "b" }, { m: "jss-pyq", i: 31, p: "c" }, { m: "jss-pyq", i: 33, p: "c" },
  { m: "jss-pyq", i: 36, p: "a" }, { m: "jss-pyq", i: 38, p: "d" }, { m: "jss-pyq", i: 44, p: "a" }, { m: "jss-pyq", i: 45, p: "b" },
  { m: "jss-pyq", i: 51, p: "d" }, { m: "jss-pyq", i: 52, p: "c" }, { m: "jss-pyq", i: 54, p: "d" }, { m: "jss-pyq", i: 55, p: "d" },
  { m: "jss-pyq", i: 66, p: "c" }, { m: "jss-pyq", i: 74, p: "a" }, { m: "jss-pyq", i: 75, p: "d" }, { m: "jss-pyq", i: 78, p: "a" },
  { m: "jss-pyq", i: 79, p: "c" }, { m: "jss-pyq", i: 81, p: "a" }, { m: "jss-pyq", i: 86, p: "c" }, { m: "jss-pyq", i: 87, p: "b" }
].map(function (x) { x.t = Date.UTC(2026, 9, 19, 9, 22); return x; });

window.REVENGE_LESSONS = {
  "jss-pyq:24": {
    s: [
      "Psychotherapy research has one big question running through it: do therapies work because of their special techniques, or because of things every therapy shares? This question is called the common factors debate.",
      "Jerome Frank (1909 to 2005) was an American psychiatrist at Johns Hopkins. In 1961 he published Persuasion and Healing (revised 1973, and again in 1991 with his daughter Julia Frank). He compared psychotherapy with faith healing, shamanism, religious conversion and the placebo effect, and found the same four ingredients in all of them: (1) an emotionally charged, confiding relationship with a helper; (2) a healing setting that society recognises; (3) a rationale or \"myth\" that explains the person's suffering; and (4) a ritual or procedure that both patient and healer believe in.",
      "His central idea is demoralization. People come to therapy because they feel helpless and hopeless, and every therapy works partly by remoralizing them: restoring hope and a sense of mastery. This is the root of the common factors model, alongside Saul Rosenzweig's 1936 \"Dodo bird verdict\" (all therapies roughly tie, \"everybody has won and all must have prizes\") and Bruce Wampold's later work.",
      "The question flips the title to \"Healing and Persuasion\". Same book. Learn it as: Frank = Persuasion and Healing = common factors = remoralization."
    ],
    f: "Winnicott is a real, big therapy name, so it felt familiar. But the option says \"Charles Winnicot\": wrong first name and a missing t. The real one is Donald Winnicott, the British paediatrician and analyst of the good-enough mother, the transitional object, the holding environment and the true and false self. A famous surname with the wrong first name is almost always a distractor.",
    h: "Frank talk persuades and heals: Frank wrote Persuasion and Healing."
  },
  "jss-pyq:26": {
    s: [
      "Every research project starts by finding out what is already known about the problem. Everything already published on it (theories, studies, reviews, books, theses) is called the literature. Reading it and writing a critical summary is the review of literature, usually chapter 2 of a thesis.",
      "The research process in order: identify the problem, review the literature, frame the hypothesis, choose the design and sample, collect data, analyse, report. The review comes second because it tells you what gap exists, stops you from repeating work already done, sharpens your hypothesis, shows you which tools and methods have worked, and gives you the theoretical framework.",
      "Types of review: a narrative review (the classic summary), a systematic review (a fixed, reproducible search, reported with the PRISMA guidelines) and a meta-analysis (statistically pooling effect sizes; Gene Glass coined the term in 1976). Sources are primary (the original study) or secondary (someone else describing it)."
    ],
    f: "\"Repository\" sounds technical and research-y. Repositories are real (an institutional repository, or Shodhganga for Indian theses), but a repository is the place where papers are stored. The literature is the body of work itself. Archive is the same trap: a place that keeps records.",
    h: "The shelf is the repository. What sits on the shelf is the literature."
  },
  "jss-pyq:31": {
    s: [
      "Two amino acid chains feed the brain's neurotransmitters, and this question is about keeping them apart.",
      "Chain 1 (catecholamines): phenylalanine, via the enzyme phenylalanine hydroxylase, becomes tyrosine. Tyrosine, via tyrosine hydroxylase, becomes L-DOPA, then dopamine, then norepinephrine, then epinephrine. Tyrosine is also the starting point for melanin, the skin and hair pigment.",
      "Chain 2 (indoleamines): tryptophan, via tryptophan hydroxylase, becomes 5-HTP, then serotonin, then melatonin.",
      "Phenylketonuria (PKU) is a break in chain 1. It is autosomal recessive (PAH gene, chromosome 12), first described by the Norwegian doctor Asbjorn Folling in 1934, who found phenylpyruvic acid in the urine of two intellectually disabled siblings. Without the enzyme, phenylalanine piles up to toxic levels and tyrosine runs short. Untreated it causes intellectual disability, seizures, a musty smell and fair skin and hair (less melanin). Newborns are screened with the Guthrie heel-prick test, and a low-phenylalanine diet from birth prevents the damage.",
      "Psychology's favourite point about PKU: it is a genetic disorder whose outcome is changed by the environment (diet). So high heritability does not mean unchangeable."
    ],
    f: "Tryptophan is also an amino acid that turns into a neurotransmitter, so it sits in the same box in your head. Both have a \"hydroxylase\" enzyme too. But tryptophan feeds serotonin, a separate chain. Phenylalanine only ever goes to tyrosine.",
    h: "P then T then D: Phenylalanine, Tyrosine, DOPA, Dopamine. Tryptophan is a trip to sleep: serotonin, then melatonin."
  },
  "jss-pyq:33": {
    s: [
      "Marsha Linehan (University of Washington) built Dialectical Behavior Therapy in the late 1980s for chronically suicidal women with borderline personality disorder. Her manual came out in 1993. Standard CBT pushed hard for change and these patients felt invalidated; pure acceptance did not stop the self-harm.",
      "\"Dialectical\" means holding two opposites together: acceptance and change. DBT teaches four skill modules: core mindfulness, distress tolerance, emotion regulation and interpersonal effectiveness. It runs in four modes: individual therapy, group skills training, phone coaching and a therapist consultation team.",
      "Mindfulness is the base module and it comes from Zen Buddhism, which Linehan practised herself. The \"what\" skills are observe, describe and participate. The \"how\" skills are non-judgmentally, one-mindfully and effectively. Wise Mind is the overlap of emotion mind and reasonable mind.",
      "Other mindfulness-based therapies: MBSR (Jon Kabat-Zinn, 1979) and MBCT (Segal, Williams and Teasdale) also draw on Buddhist meditation. CBT and REBT have a different root: Stoic philosophy (Epictetus: we are disturbed not by things but by our views of them)."
    ],
    f: "\"Dialectical\" sounds like philosophy, and psychoanalysis is the oldest \"deep\" therapy, so it feels like a safe default. But DBT is a CBT-family therapy, and psychoanalysis is about unconscious conflict, not training present-moment awareness.",
    h: "DBT mindfulness = Zen. CBT reframing = Stoics."
  },
  "jss-pyq:36": {
    s: [
      "Atkinson and Shiffrin (1968) pictured short-term memory as one passive box between the senses and long-term memory. Baddeley and Hitch (1974) replaced it with working memory: an active workspace with several parts.",
      "The three original parts: the central executive (an attention controller: it focuses, switches and divides attention, but stores nothing itself); the phonological loop (a phonological store plus articulatory rehearsal; it explains the word-length effect, the phonological similarity effect and why articulatory suppression wrecks verbal recall); and the visuospatial sketchpad (visual and spatial images; Logie split it into a visual cache and an inner scribe).",
      "The problem: where do sound, sight and stored knowledge get bound into one scene, and how do amnesic patients recall a whole paragraph immediately when the loop only holds a few words? In 2000 Baddeley added a fourth part, the episodic buffer: a limited-capacity (about 4 chunks), multimodal store that binds information from the loop, the sketchpad and long-term memory into single coherent episodes, available to conscious awareness."
    ],
    f: "The central executive \"coordinates\" everything, so \"integrating\" sounds like its job. But the executive only directs attention; it has no storage. The place where the bound episode is actually held is the episodic buffer. Keyword rule: \"integrate into a coherent episode\" = episodic buffer; \"control, attention, switching, inhibition\" = central executive.",
    h: "The executive is the manager who decides. The buffer is the meeting room where everything is put together. Added in 2000."
  },
  "jss-pyq:38": {
    s: [
      "This sits under impression formation: how we build a picture of another person from bits of information.",
      "Edward Thorndike named the halo effect in 1920 (\"A constant error in psychological ratings\"). Army officers rating soldiers on physique, intelligence, leadership and character gave ratings that correlated far too highly: a soldier who looked good was rated good at everything. One global impression spreads to separate, specific traits. The negative version is the horn effect. Dion, Berscheid and Walster (1972) showed the attractiveness form of it: \"what is beautiful is good\".",
      "Close neighbours to keep apart: Asch (1946) central traits (swapping warm for cold changed the whole impression) and the primacy effect (the order intelligent, industrious, impulsive, critical, stubborn, envious beats the reverse); Kelley (1950) warm-cold guest lecturer study; anchoring (Tversky and Kahneman, 1974), where estimates stay too close to a first number; self-serving bias; false consensus effect (Ross, Greene and House, 1977)."
    ],
    f: "Option D describes first impressions controlling later judgments, which is how people loosely talk about the halo, and it is very close to Asch's primacy effect. The difference: the halo spreads sideways, from one overall impression to other traits. Primacy and anchoring work across time, from what came first to what comes later.",
    h: "A halo spreads sideways (trait to trait). An anchor holds you in place (first to later)."
  },
  "jss-pyq:44": {
    s: [
      "A cohort study starts with two groups, exposed and unexposed (here: got the intervention or not), follows them forward and counts new cases (incidence) of the outcome (relapse).",
      "Risk ratio (relative risk) = incidence in the exposed group divided by incidence in the unexposed group. Example: 30 of 100 relapse with the intervention and 30 of 100 without. 0.30 divided by 0.30 = 1.0.",
      "Read any ratio against 1. RR = 1: no difference, no association. RR above 1: higher risk in the exposed (2.0 = double). RR below 1: protective (0.5 = half the risk). Significance comes from the 95% confidence interval: if it includes 1, the result is not significant.",
      "The odds ratio is the case-control version. Case-control studies start from the outcome and look back at exposure, so they cannot measure incidence and use odds instead. Related numbers: attributable risk = incidence exposed minus incidence unexposed; number needed to treat = 1 divided by the absolute risk reduction."
    ],
    f: "You likely read 1.0 as \"one extra\" or 100% more. A ratio of 1 means the top and bottom are the same number. Double would be 2.0.",
    h: "Ratio 1 = 1 to 1 = the same. Like a 1:1 scale model: nothing changed."
  },
  "jss-pyq:45": {
    s: [
      "The first two schools of psychology asked opposite questions.",
      "Structuralism asked WHAT the mind is made of. Wilhelm Wundt opened the first psychology lab at Leipzig in 1879 and is the father of experimental psychology (he called his own system voluntarism). His student Edward Titchener took it to Cornell and named it structuralism: break consciousness into elements (sensations, images, feelings) by trained introspection.",
      "Functionalism asked WHY: what is the mind FOR, and how does it help us adapt? William James at Harvard (Principles of Psychology, 1890; stream of consciousness; habit; the James-Lange theory of emotion) is its leading figure. The Chicago school made it formal: John Dewey's 1896 reflex arc paper, James Rowland Angell's 1906 \"The province of functional psychology\", Harvey Carr. Columbia added Cattell, Thorndike and Woodworth. Darwin's natural selection inspired the whole idea of mind as an adaptation, which is why functionalism led into applied work: education, individual differences, testing.",
      "Behaviourism (John B. Watson, 1913) then threw out consciousness entirely."
    ],
    f: "The option says \"William Wundt\". His real first name is Wilhelm. Sharing \"William\" with William James makes it feel right, but Wundt is structure (what), James is function (why). Wrong first name on a famous surname is a distractor flag, the same trick as \"Charles Winnicot\" and \"Richmond Fromm\" in this paper.",
    h: "Wundt asks what. James asks why."
  },
  "jss-pyq:51": {
    s: [
      "Operant conditioning (B. F. Skinner) has five outcomes. Learn them as a grid: add or remove, pleasant or unpleasant.",
      "Positive reinforcement: add something pleasant, behaviour goes up (praise for homework). Negative reinforcement: remove something unpleasant, behaviour goes up. It has two subtypes: escape (the unpleasant thing is already there and the response ends it: taking a painkiller for a headache) and avoidance (the response stops it before it starts: leaving early to dodge traffic).",
      "Positive punishment: add something unpleasant, behaviour goes down (a scolding). Negative punishment: remove something pleasant, behaviour goes down (time-out, response cost, losing phone time).",
      "Extinction: stop delivering the reinforcer that was keeping a behaviour going, and the behaviour fades. Tantrums are usually kept going by attention, so planned ignoring removes the reinforcer: that is the textbook example of extinction. Expect an extinction burst (it gets worse before it gets better) and possibly spontaneous recovery later."
    ],
    f: "\"Deliberately ignores\" sounds like the parent is avoiding the child, so \"avoidance\" jumped out. But operant avoidance is the learner making a response that prevents something unpleasant, and it strengthens behaviour. Ignoring is the parent giving no response at all, which weakens it.",
    k: "Disputed key: the paper keys C (operant escape). The textbook answer is B, extinction, and the deep explanation below says the same. Learn it as extinction. If this exact question appears on JSS, know that this paper-setter keyed escape.",
    h: "Ignore it and it goes extinct."
  },
  "jss-pyq:52": {
    s: [
      "Paraphilic disorders (DSM-5-TR): recurrent, intense sexual arousal to atypical objects, situations or targets for at least 6 months, plus distress or impairment, or acting on it with a non-consenting person. DSM lists eight.",
      "Group 1, unusual activity preferences. Courtship disorders: voyeuristic (watching an unsuspecting person undress or have sex), exhibitionistic (exposing one's genitals to a stranger), frotteuristic (touching or rubbing against a non-consenting person, usually in a crowd). Algolagnic disorders: sexual masochism (being humiliated, bound or made to suffer) and sexual sadism (another person's suffering).",
      "Group 2, unusual target preferences: pedophilic (prepubescent children), fetishistic (non-living objects, or a highly specific non-genital body part, with specifiers for body parts or non-living objects), transvestic (cross-dressing).",
      "Fetishistic disorder excludes clothing used only for cross-dressing (that is transvestic) and devices made for genital stimulation such as vibrators. Necrophilia (corpses), zoophilia (animals) and telephone scatologia fall under \"other specified paraphilic disorder\"."
    ],
    f: "Frotteurism has a physical, touch-based feel that can blur into \"using something\". But its target is a person in a crowd. An inanimate object is only fetishism.",
    h: "Frotteur comes from French frotter, to rub: you rub a person. Fetish comes from Portuguese feitico, a charm: an object."
  },
  "jss-pyq:54": {
    s: [
      "A concept is a mental category that groups things by shared features, so you can recognise a new example without learning it from scratch.",
      "The textbook stage list this question uses (common in Indian general psychology texts) goes: Observation (meet many examples) then Discrimination (notice how examples differ from non-examples) then Generalization (treat all members with the key features as the same) then Abstraction (pull out the common rule itself, e.g. \"mammal\" whatever the size or habitat). Texts word this slightly differently, so hold on to two anchors: it starts with observation and ends with abstraction.",
      "Wider theory worth knowing: Clark Hull (1920) showed concept learning as gradual, using Chinese characters. Bruner, Goodnow and Austin (A Study of Thinking, 1956) described concept types (conjunctive, disjunctive, relational) and strategies (simultaneous scanning, successive scanning, conservative focusing, focus gambling). Eleanor Rosch (1975) showed real concepts work by prototypes, best examples, not strict rules."
    ],
    f: "\"Assimilation\" is a famous learning word from Piaget (fitting new information into an existing schema), so it sounds like it belongs in any list about learning concepts. It is not a concept-formation stage, and its presence is the giveaway that D is wrong. D also drops abstraction, the final stage.",
    k: "No official key exists for this one. The site's key (A) is the most widely printed sequence, and the explanation below flags it as debatable.",
    h: "O-D-G-A: Only Dogs Get Applause."
  },
  "jss-pyq:55": {
    s: [
      "Hermann Rorschach, a Swiss psychiatrist, published Psychodiagnostik in 1921. The test has 10 inkblot cards: 5 achromatic (I, IV, V, VI, VII), 2 black with red (II, III) and 3 fully coloured (VIII, IX, X). It is given in two phases: the response phase (\"What might this be?\") and then the inquiry (where did you see it and what made it look like that).",
      "Every response is scored on several categories. Location is WHERE on the blot the response was seen: W (whole blot), D (common detail), Dd (unusual detail), S (white space). Exner's system adds Developmental Quality for how well the parts are put together.",
      "Determinants are WHY it looked that way: Form (F), Movement (M human, FM animal, m inanimate), Colour (FC, CF, C), Achromatic colour (C'), Shading (texture T, vista V, diffuse Y), Form dimension (FD) and reflections. Content is WHAT it is: H human, A animal, An anatomy, Ls landscape, Na nature and so on. Popular (P) marks responses most people give, and Form Quality marks how well the percept fits the blot.",
      "Scoring systems: Beck, Klopfer, Exner's Comprehensive System (1974, the standard for decades) and R-PAS (Meyer and colleagues, 2011). Rough interpretation: many W = integrating and ambitious; mostly D = practical; many Dd = obsessive detail focus; S = oppositional tendency; M = inner life and imagination; C = emotional reactivity."
    ],
    f: "\"Figure/Landscape\" sounds like what you see in the blot. That is the Content category (landscape is literally a content code, Ls). Location only ever means the place on the card: whole or part.",
    h: "Location = Where. Determinants = Why it looked so. Content = What it is. W, D, Dd and S are all places."
  },
  "jss-pyq:66": {
    s: [
      "Albert Bandura (Stanford) grew social learning theory into social cognitive theory (Social Foundations of Thought and Action, 1986).",
      "Reciprocal determinism (his 1978 paper \"The self system in reciprocal determinism\") says three things keep influencing each other in both directions: Person factors (thoughts, beliefs, expectations, biology), Behaviour, and Environment. It is a triangle with two-way arrows. Compare: Skinner runs one way (environment shapes behaviour); trait theory runs one way (person drives behaviour).",
      "The rest of Bandura you should own: observational learning (Bobo doll studies, 1961, 1963, 1965) with four processes: attention, retention, reproduction, motivation; self-efficacy (1977), built from four sources: mastery experiences, vicarious experience, verbal persuasion, and physiological and emotional states; self-regulation; human agency; moral disengagement.",
      "Same family: Julian Rotter's locus of control and Walter Mischel's cognitive-affective personality system (CAPS)."
    ],
    f: "Humanistic theory also says people are not passive products of their environment, and it talks a lot about the self, so \"people shape their surroundings\" felt humanistic. But humanistic means Rogers and Maslow: self-actualisation, unconditional positive regard, congruence, the hierarchy of needs. The person-behaviour-environment triangle is Bandura's alone.",
    h: "Reciprocal = the P-B-E triangle with arrows both ways = Bandura."
  },
  "jss-pyq:74": {
    s: [
      "Two big explanations of sex differences in behaviour compete, and exams love pairing each with its author.",
      "Evolutionary account: David Buss (his 1989 study of mate preferences across 37 cultures; sexual strategies theory with David Schmitt, 1993). Differences are inherited adaptations to ancestral pressures, building on Robert Trivers' parental investment theory (1972).",
      "Social role theory: Alice Eagly (Sex Differences in Social Behavior: A Social-Role Interpretation, 1987; later the biosocial construction model with Wendy Wood, 1999). A society's division of labour puts men and women into different roles (provider and leader versus homemaker and carer). Those roles create gender roles: communal traits expected of women, agentic traits expected of men. People learn the skills and beliefs their roles need, and onlookers then read the differences as inborn. Eagly and Karau's role congruity theory (2002) explains prejudice against women leaders.",
      "Other gender theories: Sandra Bem's gender schema theory (1981) and her Bem Sex Role Inventory (1974, androgyny); Kohlberg's cognitive-developmental account of gender constancy."
    ],
    f: "Buss is the name most tied to \"sex differences\" research, so it came up first. But Buss is the evolutionary side, the very theory social role theory was built to argue against.",
    h: "Eagly looks down at society's roles. Buss looks back at evolution."
  },
  "jss-pyq:75": {
    s: [
      "There are four main ways to build a personality test.",
      "1. Rational (theoretical, deductive): decide the trait first and write items that obviously fit it. Examples: Woodworth Personal Data Sheet (1917), Edwards Personal Preference Schedule (from Murray's needs), MBTI (from Jung). 2. Empirical criterion keying: write a huge item pool and keep only the items that a criterion group (say, diagnosed depressed patients) answers differently from normal controls, whatever the item seems to be about. Examples: MMPI, Strong Vocational Interest Blank, Gough's CPI. 3. Factor analytic: let correlations group the items. Examples: Cattell's 16PF, Eysenck's EPQ, Costa and McCrae's NEO-PI-R. 4. Mixed or sequential: Jackson's PRF, Millon's MCMI.",
      "MMPI facts: Hathaway and McKinley, University of Minnesota, 1943; true/false format. Versions: MMPI-2 (1989, 567 items), MMPI-A (adolescents, 478 items), MMPI-2-RF (2008, 338 items), MMPI-3 (2020, 335 items). Ten clinical scales: 1 Hs hypochondriasis, 2 D depression, 3 Hy hysteria, 4 Pd psychopathic deviate, 5 Mf masculinity-femininity, 6 Pa paranoia, 7 Pt psychasthenia, 8 Sc schizophrenia, 9 Ma hypomania, 0 Si social introversion. Validity scales: ? (cannot say), L, F, K, later VRIN, TRIN, F-back. On the MMPI-2 a T-score of 65 or more is clinically significant."
    ],
    f: "\"Both a and b\" feels safe when two statements sound reasonable. Here a and b are the same idea said twice: both describe the rational method. When two options are near-synonyms and they describe the opposite of the real method, both are out, and so is \"both\".",
    h: "MMPI kept the items patients answered differently: chosen by data, not by meaning."
  },
  "jss-pyq:78": {
    s: [
      "Defence mechanisms were first described by Sigmund Freud and organised by Anna Freud (The Ego and the Mechanisms of Defence, 1936). They work unconsciously to cut anxiety from conflict between id, superego and reality.",
      "George Vaillant (1977) ranked them by maturity. Psychotic level: denial of external reality, distortion, delusional projection. Immature: projection, acting out, passive aggression, schizoid fantasy, hypochondriasis. Neurotic: repression, displacement, reaction formation, intellectualisation, isolation of affect. Mature: sublimation, humour, altruism, suppression, anticipation.",
      "The three in this question. Denial: refusing to accept an outside reality that is too painful (\"the diagnosis is wrong\"). Projection: putting your own unacceptable feelings onto someone else (\"he hates me\" when you hate him). Introjection: taking another person's attitudes or qualities into yourself (a child taking on a parent's voice as conscience).",
      "Projection also has a broad meaning: L. K. Frank's projective hypothesis (1939) says our inner needs shape how we see ambiguous things. That is the whole basis of projective tests such as the Rorschach and TAT."
    ],
    f: "Your reasoning was sound: \"the inner world shaping how the outer world is seen\" is the broad meaning of projection, the one behind projective tests. The paper's key goes with denial instead.",
    k: "Disputed key: the paper keys D (denial), but the wording is close to the broad meaning of projection. Know both. If the stem is about refusing to accept a painful fact, it is denial. If it is about inner states colouring how the outside world is perceived, the textbook term is projection. For JSS, remember this paper keyed denial.",
    h: "Denial: \"it isn't happening.\" Projection: \"it's you, not me.\" Introjection: \"your voice is now in my head.\""
  },
  "jss-pyq:79": {
    s: [
      "Emil Kraepelin (1893, refined by 1899) split the major psychoses by course: dementia praecox (early onset, deteriorating) versus manic-depressive insanity (episodic, with recovery).",
      "Eugen Bleuler, director of the Burgholzli clinic in Zurich, coined \"schizophrenia\" in 1908 and wrote Dementia Praecox or the Group of Schizophrenias (1911). The name means a splitting of mental functions (thought from emotion from behaviour), not multiple personality, and he did not think it always deteriorated.",
      "His fundamental symptoms are the 4 A's: loosened Associations, Affective flattening or inappropriateness, Ambivalence (contradictory feelings, wishes or ideas held at the same time; he described affective, volitional and intellectual kinds), and Autism (withdrawal into an inner world). Bleuler coined both \"ambivalence\" and \"autism\". Hallucinations, delusions and catatonia were only accessory symptoms to him.",
      "Kurt Schneider (1959) later listed the first-rank symptoms: audible thoughts, voices arguing or commenting, thought insertion, withdrawal and broadcasting, delusional perception, and made (passivity) experiences. Freud borrowed \"ambivalence\" for psychoanalysis, which is why his name tempts people."
    ],
    f: "\"Richmond Fromm\" copies Erich Fromm with the wrong first name, the same trick as \"Charles Winnicot\" and \"William Wundt\" in this paper. Erich Fromm (Escape from Freedom, The Art of Loving) was a neo-Freudian; he coined nothing about schizophrenia.",
    h: "Bleuler coined the A-words: Ambivalence and Autism are both his."
  },
  "jss-pyq:81": {
    s: [
      "Reasoning runs in two directions.",
      "Deduction goes from general to specific. If the premises are true, the conclusion must be true. The classic syllogism: all men are mortal; Socrates is a man; so Socrates is mortal. Research version: the hypothetico-deductive method (theory, then hypothesis, then test), which Karl Popper tied to falsification.",
      "Induction goes from specific to general. You see many cases, spot a pattern and generalise. Its conclusions are only probable: one new case can overturn them (David Hume's problem of induction; Francis Bacon championed it). Research version: quantitative work mostly tests theory deductively, while qualitative work mostly builds theory inductively, e.g. grounded theory (Glaser and Strauss, 1967).",
      "A third type, abduction (Charles Peirce), is inference to the best explanation."
    ],
    f: "A pure reversal trap: the two terms are mirror images, and under exam pressure the brain flips them.",
    h: "INduction: from INdividual cases INto a rule. DEduction: DEscend from the rule DOwn to the case."
  },
  "jss-pyq:86": {
    s: [
      "Parenting styles: Diana Baumrind (1966, 1971) described authoritative (high warmth, high control), authoritarian (low warmth, high control) and permissive (high warmth, low control). Maccoby and Martin (1983) added neglectful or uninvolved (low warmth, low control).",
      "Helicopter parenting is over-involvement that does not fit the child's age: hovering, solving problems the child could solve, managing their life. The image comes from Haim Ginott's Between Parent and Teenager (1969: \"Mother hovers over me like a helicopter\"), and Cline and Fay popularised the term in 1990. Research (for example Padilla-Walker and Nelson, 2012) treats it as separate from ordinary behavioural control.",
      "Its causes are several at once: parental anxiety (fear of failure, harm or an uncertain economy), unfulfilled wishes and regret (living through the child, overcompensating), the parent's own traits (neuroticism, perfectionism, need for control), and pressure from other parents. The effects on young adults are lower self-efficacy, more anxiety and depression, and poorer coping. Cousins: snowplough or lawnmower parenting, and tiger parenting (Amy Chua, 2011)."
    ],
    f: "Personality traits really are a cause, so it felt right. Exam rule: when you can defend two or more options and \"All of the above\" is there, it is almost always the key.",
    h: "If you can defend two options, the answer is \"All\"."
  },
  "jss-pyq:87": {
    s: [
      "Alfred Adler broke from Freud in 1911 and founded Individual Psychology. His core ideas: inferiority feelings and compensation, striving for superiority (significance), social interest (Gemeinschaftsgefuhl), style of life, fictional finalism (borrowed from Vaihinger's philosophy of \"as if\"), birth order and family constellation, and early recollections. Rudolf Dreikurs added the four mistaken goals of misbehaviour: attention, power, revenge, display of inadequacy.",
      "Adlerian therapy has four phases: building the relationship, assessment (lifestyle analysis), insight and interpretation, and reorientation. It is collaborative and looks at the present and the future.",
      "Adlerian techniques: encouragement (the central one), acting as if (behave as though you were already the person you want to be), the push-button technique (Harold Mosak: picture a pleasant memory, then an unpleasant one, notice the feelings follow, so you can \"push the button\" for the feeling you choose), spitting in the client's soup (exposing the hidden payoff of a behaviour so it loses its appeal), catching oneself, paradoxical intention, task setting, and \"The Question\" (what would be different if you were well?).",
      "Analysis of transference belongs to Freud's psychoanalysis, together with free association, dream analysis and the analysis of resistance."
    ],
    f: "\"Push button\" sounds like a gimmick, not a real therapy technique, so it looked like the odd one out. It is actually Harold Mosak's Adlerian technique. On \"which is NOT Adlerian\" questions, look for the Freudian one.",
    h: "Adler looks forward (goals: as if, push button, encouragement). Freud looks back (transference)."
  }
};
