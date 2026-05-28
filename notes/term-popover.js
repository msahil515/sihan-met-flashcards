/* term-popover.js — tap a bolded term or abbreviation to see its definition.
   Auto-picks every <b>/<strong>, plus common abbreviations (SMA, preSMA, fMRI,
   NMDA, AMPA, HPA, BDNF, KF rings, etc.). Tap anywhere outside the popover to
   close. Built 2026-05-28 for the rizzolatti page + every notes/ page.

   Definitions come from three sources, in priority order:
   1. The built-in TERM_DEFS dictionary below (curated for MET/NIMHANS).
   2. A "defining occurrence" auto-extracted from the page itself
      (the first sentence/list item where the term is bolded and followed
      by a definitional dash or colon).
   3. Fallback: the first paragraph of context where the term appears.

   This means even novel bolded terms on a new page get a useful popover. */
(function () {
  "use strict";
  if (window.__tpLoaded) return;
  window.__tpLoaded = true;

  /* -------------------- 1. DEFINITIONS DICTIONARY -------------------- */

  var TERM_DEFS = {
    /* Neuroanatomy */
    "sma": "Supplementary motor area. Medial premotor cortex (BA 6). Plans internally-generated, well-learned movement sequences. Lesion → akinesia, motor neglect, alien hand.",
    "presma": "Pre-supplementary motor area. Rostral to SMA proper. Selects between competing motor plans, inhibits prepotent responses, big in stop-signal task and Libet readiness-potential studies.",
    "m1": "Primary motor cortex (BA 4). Precentral gyrus. Direct projections to spinal motor neurons via corticospinal tract; somatotopic motor homunculus.",
    "s1": "Primary somatosensory cortex (BA 1/2/3). Postcentral gyrus. Sensory homunculus.",
    "v1": "Primary visual cortex (BA 17). Striate cortex. Calcarine fissure. Retinotopic.",
    "a1": "Primary auditory cortex (BA 41/42). Heschl's gyrus, superior temporal lobe. Tonotopic.",
    "ifg": "Inferior frontal gyrus. Houses Broca's area (BA 44/45) on the left and parts of the human mirror-neuron system.",
    "ipl": "Inferior parietal lobule. Supramarginal + angular gyri. Part of the human mirror system, also implicated in apraxia and theory-of-mind tasks.",
    "sts": "Superior temporal sulcus. Biological-motion processing, theory of mind, voice perception, audiovisual integration.",
    "mfg": "Middle frontal gyrus. DLPFC sits here. Working memory, executive control.",
    "dlpfc": "Dorsolateral prefrontal cortex (BA 9/46). Working memory, planning, cognitive control. Hypoactive in schizophrenia (hypofrontality) and depression.",
    "vmpfc": "Ventromedial prefrontal cortex. Value, social emotion, Damasio's somatic-marker hypothesis. Phineas Gage lesion zone.",
    "ofc": "Orbitofrontal cortex. Reward valuation, reversal learning, impulse control. Lesion → disinhibition, pseudopsychopathic syndrome.",
    "acc": "Anterior cingulate cortex. Conflict monitoring, error detection (ERN), pain affect.",
    "pcc": "Posterior cingulate cortex. Core node of the default-mode network. Self-referential thought.",
    "dmn": "Default-mode network. PCC + mPFC + angular gyrus + lateral temporal. Active at rest, deactivates during goal-directed task. Disrupted in Alzheimer's, schizophrenia, depression.",
    "vta": "Ventral tegmental area. Origin of the mesolimbic dopamine pathway (→ NAcc, reward) and mesocortical pathway (→ PFC). All drugs of abuse converge here.",
    "snc": "Substantia nigra pars compacta. Origin of the nigrostriatal dopamine pathway (→ dorsal striatum). Degenerates in Parkinson's disease.",
    "nacc": "Nucleus accumbens. Ventral striatum. Final common reward node; activity tracks prediction-error signals.",
    "pag": "Periaqueductal grey. Midbrain. Endogenous opioid analgesia, defensive freezing/fight-or-flight.",
    "lc": "Locus coeruleus. Pontine noradrenergic nucleus. Arousal, vigilance, REM-off cell group.",
    "drn": "Dorsal raphe nucleus. Main source of cortical serotonin.",
    "scn": "Suprachiasmatic nucleus. Hypothalamic master circadian pacemaker, entrained by retinohypothalamic light input.",
    "pvn": "Paraventricular nucleus of the hypothalamus. Releases CRH (HPA axis) and oxytocin/vasopressin.",
    "arc": "Arcuate nucleus of the hypothalamus. Two opposing neuron populations: POMC (anorexigenic) and NPY/AgRP (orexigenic). Hunger control hub.",
    "lh": "Lateral hypothalamus. Hunger-on centre (orexin/hypocretin neurons). Lesion → aphagia.",
    "vmh": "Ventromedial hypothalamus. Satiety centre. Lesion → hyperphagia, obesity (VMH syndrome).",
    "mtl": "Medial temporal lobe. Hippocampus + entorhinal/perirhinal/parahippocampal cortex. Declarative memory, lesion → anterograde amnesia (H.M.).",
    "ca1": "CA1 region of the hippocampus. Receives Schaffer collaterals from CA3; classic site of NMDA-dependent long-term potentiation.",
    "ca3": "CA3 region of the hippocampus. Recurrent collaterals; pattern completion.",
    "dg": "Dentate gyrus. Hippocampal input region. One of the few adult neurogenic sites.",
    "ec": "Entorhinal cortex. Gateway to the hippocampus; grid cells.",

    /* Neurotransmitters & molecules */
    "nmda": "N-methyl-D-aspartate receptor. Glutamate-gated cation channel that needs both ligand and depolarisation to open (Mg²⁺ block); coincidence detector for Hebbian LTP.",
    "ampa": "α-amino-3-hydroxy-5-methyl-4-isoxazolepropionic acid receptor. Fast glutamate ionotropic receptor; insertion of AMPA receptors is the expression mechanism of LTP.",
    "gaba": "γ-aminobutyric acid. Main inhibitory neurotransmitter. GABA-A is a Cl⁻ channel (benzodiazepine, barbiturate, alcohol target); GABA-B is metabotropic (baclofen).",
    "glu": "Glutamate. Main excitatory neurotransmitter in the CNS. Acts on NMDA, AMPA, kainate, and metabotropic mGluR receptors.",
    "5-ht": "5-hydroxytryptamine. Serotonin. Raphe nuclei. Mood, sleep, appetite, aggression. SSRIs.",
    "da": "Dopamine. Catecholamine. Reward prediction error (mesolimbic), motor control (nigrostriatal), executive function (mesocortical), prolactin inhibition (tuberoinfundibular).",
    "ne": "Norepinephrine (noradrenaline). Locus coeruleus. Arousal, vigilance, fight-or-flight (with adrenal medulla).",
    "ach": "Acetylcholine. Basal forebrain → cortex (memory, lost in Alzheimer's), pedunculopontine → thalamus (REM), and at the neuromuscular junction.",
    "bdnf": "Brain-derived neurotrophic factor. Neurotrophin that supports neuronal survival, synaptic plasticity (drives late-phase LTP), and adult neurogenesis. Low in depression; SSRI/ketamine/exercise raise it.",
    "creb": "cAMP response element-binding protein. Transcription factor activated downstream of PKA; gates the gene-transcription step that turns early-phase into late-phase LTP and short-term into long-term memory.",
    "ltp": "Long-term potentiation. Persistent strengthening of a synapse after high-frequency stimulation. NMDA-dependent in CA1. The cellular model for Hebbian learning.",
    "ltd": "Long-term depression. Persistent weakening of a synapse after low-frequency stimulation. Removes AMPA receptors. Cerebellar LTD underlies motor learning.",
    "epsp": "Excitatory postsynaptic potential. Small depolarisation; sums spatially and temporally to reach threshold.",
    "ipsp": "Inhibitory postsynaptic potential. Hyperpolarisation, typically Cl⁻ influx via GABA-A.",
    "ap": "Action potential. All-or-none spike. ~−55 mV threshold, peaks +30–40 mV. Na⁺ in (depolarise), K⁺ out (repolarise), refractory period, propagates saltatorily on myelinated axons.",
    "crh": "Corticotropin-releasing hormone. PVN → anterior pituitary. Top of the HPA axis.",
    "acth": "Adrenocorticotropic hormone. Anterior pituitary → adrenal cortex; drives cortisol release.",
    "hpa": "Hypothalamic-pituitary-adrenal axis. CRH → ACTH → cortisol. Negative feedback on hippocampus, PVN, pituitary. Chronic stress dysregulates feedback → hippocampal atrophy.",
    "hpg": "Hypothalamic-pituitary-gonadal axis. GnRH → LH/FSH → testes/ovaries.",
    "hpt": "Hypothalamic-pituitary-thyroid axis. TRH → TSH → T3/T4.",

    /* Imaging / methods */
    "fmri": "Functional magnetic resonance imaging. Measures the BOLD signal (deoxyhaemoglobin contrast) as an indirect proxy for neural activity. Spatial mm, temporal seconds.",
    "bold": "Blood-oxygen-level-dependent signal. The contrast fMRI measures; rises with neural activity because of an over-supply of oxygenated blood (the haemodynamic response).",
    "pet": "Positron emission tomography. Tracks a radio-labelled tracer (FDG for glucose, raclopride for D2 receptors, etc.). Worse spatial/temporal resolution than fMRI but lets you image specific neurochemistry.",
    "eeg": "Electroencephalography. Scalp electrodes. Millisecond temporal resolution, poor spatial. Bands: delta <4, theta 4–8, alpha 8–13, beta 13–30, gamma 30–80 Hz.",
    "erp": "Event-related potential. Time-locked averaging of EEG. Components: P300 (oddball/working memory), N400 (semantic violation), MMN (mismatch negativity), ERN (error-related negativity), CNV (contingent negative variation).",
    "meg": "Magnetoencephalography. Measures magnetic fields from cortical currents. Same temporal resolution as EEG, better spatial localisation, expensive.",
    "tms": "Transcranial magnetic stimulation. Pulsed magnetic field induces a current in cortex; can excite or transiently disrupt a region. Used as therapy (rTMS for depression) and to test causal role of a region.",
    "tdcs": "Transcranial direct current stimulation. Weak DC scalp current; anodal excites, cathodal inhibits. Mostly research, limited therapy evidence.",
    "dti": "Diffusion tensor imaging. MRI sequence that maps water diffusion to reconstruct white-matter tracts. Used to image disconnections (e.g. callosal damage, schizophrenia).",
    "ct": "Computed tomography. X-ray; good for bleeds and bone, poor soft-tissue contrast. Quick: first-line in acute stroke.",
    "mri": "Magnetic resonance imaging. Structural soft-tissue contrast; no ionising radiation. Sequences: T1, T2, FLAIR, DWI.",

    /* Cognitive psych / memory */
    "wm": "Working memory. Baddeley's model: central executive + phonological loop + visuospatial sketchpad + episodic buffer (added 2000).",
    "ltm": "Long-term memory. Declarative (episodic + semantic) + procedural; explicit vs implicit.",
    "stm": "Short-term memory. ~7 ± 2 items, ~20 s without rehearsal (Atkinson-Shiffrin).",
    "tot": "Tip-of-the-tongue state. Retrieval failure with strong feeling-of-knowing; Brown & McNeill 1966.",
    "fok": "Feeling of knowing. Metacognitive judgement that one would recognise a non-recalled item.",

    /* Psychiatry */
    "dsm": "Diagnostic and Statistical Manual of Mental Disorders. APA. Categorical (mostly) classification. DSM-5 (2013), DSM-5-TR (2022).",
    "icd": "International Classification of Diseases. WHO. ICD-11 became effective 2022. Used clinically worldwide; MET often tests ICD-10/11 codes.",
    "ocd": "Obsessive-compulsive disorder. Egodystonic obsessions + compulsions. Cortico-striato-thalamo-cortical loop hyperactivity. First-line: SSRI + ERP.",
    "ptsd": "Post-traumatic stress disorder. Intrusion + avoidance + negative cognition/mood + hyperarousal, >1 month after Criterion-A trauma. Hippocampus shrinks; amygdala overresponds.",
    "gad": "Generalised anxiety disorder. Excessive worry, ≥6 months, ≥3 of 6 somatic symptoms.",
    "mdd": "Major depressive disorder. ≥5 of 9 symptoms (SIGECAPS + low mood/anhedonia), ≥2 weeks.",
    "bpd": "Borderline personality disorder. Affective instability, identity diffusion, impulsivity, fear of abandonment, splitting defence. DBT is first-line.",
    "asd": "Autism spectrum disorder. Social-communication deficits + restricted/repetitive behaviours, onset early development. (Also sometimes 'acute stress disorder' — context matters.)",
    "adhd": "Attention-deficit/hyperactivity disorder. Inattention and/or hyperactivity-impulsivity, ≥6 symptoms, ≥6 months, multiple settings, onset <12 (DSM-5).",
    "sz": "Schizophrenia. Positive (delusions, hallucinations, disorganisation) + negative (avolition, alogia, flat affect, anhedonia) + cognitive symptoms. ≥1 month positive + ≥6 months total course.",
    "ssri": "Selective serotonin reuptake inhibitor. Blocks SERT. Fluoxetine, sertraline, escitalopram, paroxetine. First-line for MDD, OCD, GAD, PTSD, panic.",
    "snri": "Serotonin-norepinephrine reuptake inhibitor. Venlafaxine, duloxetine. Depression, anxiety, neuropathic pain.",
    "tca": "Tricyclic antidepressant. Amitriptyline, imipramine, clomipramine. Blocks SERT/NET + anticholinergic/antihistamine side effects. Lethal in overdose (QT, arrhythmia).",
    "maoi": "Monoamine oxidase inhibitor. Phenelzine, tranylcypromine, moclobemide (RIMA), selegiline. Tyramine-rich foods → hypertensive crisis.",
    "ect": "Electroconvulsive therapy. Brief electrical stimulus under GA → generalised seizure. Fastest acting for severe depression, catatonia, treatment-resistant SZ. Side: anterograde amnesia.",
    "cbt": "Cognitive behavioural therapy. Beck (cognitive) + behavioural techniques. Targets distorted automatic thoughts → core beliefs.",
    "dbt": "Dialectical behaviour therapy. Linehan. Skills (mindfulness, distress tolerance, emotion regulation, interpersonal effectiveness) + individual + phone coaching + team consult. First-line for BPD.",
    "emdr": "Eye movement desensitisation and reprocessing. Shapiro 1987. Bilateral stimulation (eye movements) during trauma recall. 8-phase protocol. Effective for PTSD.",
    "ipt": "Interpersonal psychotherapy. Klerman & Weissman. Targets four foci: grief, role disputes, role transitions, interpersonal deficits. Evidence in MDD, bulimia, perinatal depression.",
    "act": "Acceptance and commitment therapy. Hayes. Third-wave CBT. Hexaflex: acceptance, defusion, present moment, self-as-context, values, committed action.",
    "epse": "Extrapyramidal side effects. From D2 blockade. Acute dystonia (hours), akathisia (days), parkinsonism (weeks), tardive dyskinesia (months-years).",

    /* Clinical signs */
    "kf rings": "Kayser-Fleischer rings. Brown copper deposits at the corneal limbus. Pathognomonic of Wilson's disease (autosomal recessive ATP7B mutation; hepatolenticular degeneration; tremor, dystonia, dysarthria, psychiatric features).",
    "danish": "Cerebellar signs mnemonic. Dysdiadochokinesia, Ataxia, Nystagmus, Intention tremor, Slurred (scanning) speech, Hypotonia. The classic cerebellar lesion syndrome.",
    "siadh": "Syndrome of inappropriate antidiuretic hormone secretion. Euvolaemic hyponatraemia with concentrated urine. Drug-induced (SSRIs, carbamazepine, antipsychotics) is common in psychiatry.",
    "nms": "Neuroleptic malignant syndrome. Antipsychotic reaction: hyperthermia, rigidity (lead-pipe), autonomic instability, altered mental status, raised CK. Mortality ~10%. Treat: stop drug, bromocriptine/dantrolene.",
    "ss": "Serotonin syndrome. SSRI/MAOI etc. overload: clonus (esp. lower limb), hyperreflexia, agitation, autonomic instability, hyperthermia. Differs from NMS by clonus and faster onset.",

    /* Stats */
    "anova": "Analysis of variance. Compares means across ≥3 groups via the F-ratio (between/within variance). Fisher.",
    "ancova": "Analysis of covariance. ANOVA with continuous covariate(s) to control for confounders.",
    "manova": "Multivariate analysis of variance. Multiple DVs simultaneously. Pillai's, Wilks' lambda, Hotelling's.",
    "rr": "Relative risk (risk ratio). Risk in exposed / risk in unexposed. Used in cohort studies. RR = 1 → no effect.",
    "or": "Odds ratio. Odds in cases / odds in controls. Used in case-control studies. OR = 1 → no effect.",
    "hr": "Hazard ratio. Cox proportional-hazards model; instantaneous risk ratio over time.",
    "nnt": "Number needed to treat. 1 / absolute risk reduction. The number of patients you must treat to prevent one bad outcome.",
    "ci": "Confidence interval. Range that would contain the true parameter in a given % of repeated samples (usually 95%). If a 95% CI for a difference crosses 0 (or RR/OR crosses 1), the result is not significant at α=.05.",
    "sem": "Standard error of the mean. SD / √n. Shrinks with sample size.",
    "sd": "Standard deviation. Spread of raw scores. ~68% within ±1 SD on a normal curve.",
    "iqr": "Interquartile range. Q3 − Q1. Robust spread measure for skewed data.",

    /* Researchers / theorists (mini-cards) */
    "rizzolatti": "Giacomo Rizzolatti (Parma). With di Pellegrino, Fadiga, Gallese, Fogassi, discovered mirror neurons in macaque area F5 of premotor cortex in the early 1990s. Cells fire both when the monkey acts and when it watches another do the same act. Proposed substrate for imitation, action understanding, theory of mind.",
    "di pellegrino": "Giuseppe di Pellegrino. Co-discoverer of mirror neurons with Rizzolatti's Parma group, 1992.",
    "gallese": "Vittorio Gallese. Parma group. Extended mirror-neuron work into embodied simulation theory.",
    "broca": "Paul Broca (1861). Patient 'Tan'. Left inferior frontal gyrus lesion → non-fluent aphasia (effortful, agrammatic, good comprehension).",
    "wernicke": "Carl Wernicke (1874). Left posterior superior temporal lesion → fluent aphasia (paraphasias, neologisms, poor comprehension).",
    "geschwind": "Norman Geschwind. Disconnection-syndrome framework; conduction aphasia from arcuate-fasciculus lesion; Geschwind territory (left inferior parietal).",
    "papez": "James Papez (1937). Proposed the Papez circuit (hippocampus → fornix → mammillary bodies → anterior thalamus → cingulate → hippocampus) as the emotion circuit. Klüver-Bucy and later MacLean expanded it into the limbic system.",
    "maclean": "Paul MacLean. Triune-brain (reptilian, paleomammalian/limbic, neomammalian) — historically influential, now largely rejected. Coined 'limbic system'.",
    "kluver": "Heinrich Klüver. With Paul Bucy (1939), described Klüver-Bucy syndrome after bilateral temporal lobectomy in monkeys: hyperorality, hypersexuality, visual agnosia, placidity, hypermetamorphosis.",
    "hebb": "Donald Hebb (1949). 'Cells that fire together wire together' — the principle underlying LTP.",
    "kandel": "Eric Kandel. Aplysia gill-withdrawal: habituation, sensitisation, classical conditioning. Showed the cellular and molecular basis of short-term and long-term memory. Nobel 2000.",
    "olds": "James Olds & Peter Milner (1954). Discovered the brain's reward system via intracranial self-stimulation in rats — septal area, then medial forebrain bundle.",
    "schultz": "Wolfram Schultz. Showed midbrain dopamine neurons code reward prediction error: fire to unexpected reward, shift to predictive cue, decrease below baseline if predicted reward is omitted.",
    "damasio": "Antonio Damasio. Somatic-marker hypothesis; vmPFC and the role of bodily feedback in decision-making. Iowa Gambling Task.",
    "ledoux": "Joseph LeDoux. Mapped the low-road/high-road fear circuit: thalamus → amygdala (fast, crude) vs thalamus → cortex → amygdala (slow, detailed).",
    "milner": "Brenda Milner. Studied H.M. (Henry Molaison) post bilateral medial-temporal-lobe resection — preserved procedural learning (mirror tracing) despite dense anterograde amnesia. Founded human neuropsychology of memory.",
    "tulving": "Endel Tulving. Episodic vs semantic memory (1972), encoding-specificity principle, autonoetic consciousness.",
    "baddeley": "Alan Baddeley. Working-memory model (1974, expanded 2000 with episodic buffer). Phonological loop + visuospatial sketchpad + central executive + episodic buffer.",
    "atkinson": "Atkinson & Shiffrin (1968). Modal model: sensory register → STM → LTM, with control processes (rehearsal etc.).",
    "ebbinghaus": "Hermann Ebbinghaus (1885). First experimental memory study; nonsense syllables; forgetting curve; savings method; spacing effect.",
    "freud": "Sigmund Freud. Psychoanalysis; id/ego/superego; topographic (conscious/preconscious/unconscious); psychosexual stages; defence mechanisms.",
    "jung": "Carl Jung. Analytical psychology; collective unconscious; archetypes; individuation; introversion/extraversion; word association.",
    "adler": "Alfred Adler. Individual psychology; inferiority/superiority; striving for superiority; birth order; social interest.",
    "erikson": "Erik Erikson. 8 psychosocial stages, each a crisis (trust vs mistrust → integrity vs despair).",
    "piaget": "Jean Piaget. Genetic epistemology; 4 stages (sensorimotor, preoperational, concrete operational, formal operational); schemas; assimilation/accommodation; conservation; egocentrism.",
    "vygotsky": "Lev Vygotsky. Sociocultural theory; zone of proximal development (ZPD); scaffolding; private/inner speech; cultural tools.",
    "bandura": "Albert Bandura. Social learning theory; Bobo doll (1961); self-efficacy; reciprocal determinism; observational learning.",
    "skinner": "B. F. Skinner. Radical behaviourism; operant conditioning; reinforcement schedules; Skinner box; verbal behavior.",
    "watson": "John B. Watson. Founder of behaviourism (1913); Little Albert (with Rosalie Rayner, 1920); classical conditioning of fear.",
    "pavlov": "Ivan Pavlov. Classical conditioning; CS/US/CR/UR; salivation in dogs; experimental neurosis; second-signal system.",
    "thorndike": "Edward Thorndike. Law of effect; puzzle box; cats; connectionism — precursor to operant conditioning.",
    "tolman": "Edward Tolman. Cognitive maps; latent learning; purposive behaviourism.",
    "kohler": "Wolfgang Köhler. Gestalt psychology; insight learning in chimpanzees (Sultan, sticks, bananas).",
    "wertheimer": "Max Wertheimer. Founder of Gestalt; phi phenomenon (1912); laws of perceptual organisation.",
    "maslow": "Abraham Maslow. Humanistic; hierarchy of needs (physiological → safety → love/belonging → esteem → self-actualisation); B-needs vs D-needs.",
    "rogers": "Carl Rogers. Person-centred therapy; unconditional positive regard, empathy, congruence; Q-sort; self-concept.",
    "ellis": "Albert Ellis. Rational emotive behaviour therapy (REBT); ABC model (Activating event → Beliefs → Consequences); irrational beliefs.",
    "beck": "Aaron T. Beck. Cognitive therapy; cognitive triad (self/world/future); automatic thoughts; cognitive distortions; BDI, BAI, BHS.",
    "seligman": "Martin Seligman. Learned helplessness; positive psychology; PERMA; explanatory style; authentic happiness.",
    "ainsworth": "Mary Ainsworth. Strange Situation procedure; attachment classifications: secure, insecure-avoidant, insecure-resistant/ambivalent; later disorganised added by Main & Solomon.",
    "bowlby": "John Bowlby. Attachment theory; internal working models; monotropy; critical/sensitive period; 44 thieves; ethology-influenced.",
    "harlow": "Harry Harlow. Rhesus monkey wire vs cloth mother; contact comfort > feeding; social isolation studies.",
    "bronfenbrenner": "Urie Bronfenbrenner. Ecological systems theory; micro/meso/exo/macro/chrono; later bioecological PPCT model.",
    "kohlberg": "Lawrence Kohlberg. Moral development; 3 levels × 2 stages: preconventional, conventional, postconventional; Heinz dilemma.",
    "gilligan": "Carol Gilligan. Critiqued Kohlberg; care vs justice ethic; gender differences in moral reasoning.",
    "yalom": "Irvin Yalom. Existential therapy and group therapy. 11 therapeutic factors of group therapy; 4 ultimate concerns (death, freedom, isolation, meaninglessness).",
    "frankl": "Viktor Frankl. Logotherapy; will to meaning; paradoxical intention; 'Man's Search for Meaning'.",
    "may": "Rollo May. American existential psychology; anxiety as ontological; daimonic.",
    "perls": "Fritz Perls. Gestalt therapy; here-and-now; empty chair; top-dog/under-dog.",
    "horney": "Karen Horney. Neo-Freudian; neurotic needs; basic anxiety; womb envy; moving toward/against/away from people.",
    "fromm": "Erich Fromm. Neo-Freudian/humanistic; escape from freedom; productive vs unproductive orientations.",
    "sullivan": "Harry Stack Sullivan. Interpersonal theory; chumship; modes of experience (prototaxic/parataxic/syntaxic).",
    "klein": "Melanie Klein. Object relations; paranoid-schizoid vs depressive position; splitting; projective identification.",
    "winnicott": "Donald Winnicott. True/false self; good-enough mother; transitional object; holding environment.",
    "kohut": "Heinz Kohut. Self psychology; selfobject; empathic mirroring; idealising/twinship transferences.",
    "kernberg": "Otto Kernberg. Object relations; borderline personality organisation; structural interview; transference-focused psychotherapy.",
    "mahler": "Margaret Mahler. Separation-individuation: normal autistic, normal symbiotic, then sub-phases (differentiation, practising, rapprochement, object constancy).",
    "linehan": "Marsha Linehan. Developed DBT for borderline personality disorder.",
    "shapiro": "Francine Shapiro. EMDR (1987); 8-phase protocol.",
    "wolpe": "Joseph Wolpe. Systematic desensitisation; reciprocal inhibition; SUDS hierarchy.",
    "lazarus": "Arnold Lazarus (multimodal BASIC ID) or Richard Lazarus (transactional model of stress, appraisal-coping).",
    "selye": "Hans Selye. General adaptation syndrome (alarm → resistance → exhaustion); coined 'stress'.",
    "festinger": "Leon Festinger. Cognitive dissonance (1957); social comparison theory.",
    "asch": "Solomon Asch. Conformity line-judgement (1951); ~33% conformed; informational and normative influence.",
    "milgram": "Stanley Milgram. Obedience to authority (1963); 65% delivered max shock; six degrees of separation.",
    "zimbardo": "Philip Zimbardo. Stanford Prison Experiment (1971); deindividuation; situational power.",
    "tajfel": "Henri Tajfel. Social identity theory; minimal-group paradigm; in-group/out-group bias.",
    "bartlett": "Frederic Bartlett (1932). 'War of the Ghosts'; schemas; reconstructive memory.",
    "loftus": "Elizabeth Loftus. Misinformation effect; eyewitness testimony; lost-in-the-mall; false memories.",
    "binet": "Alfred Binet. With Théodore Simon (1905), first practical intelligence test; mental age; commissioned by the French ministry to identify children needing extra help.",
    "stern": "William Stern (1912). Coined IQ = (mental age / chronological age) × 100. Quotient IQ.",
    "terman": "Lewis Terman. Stanford revision of Binet-Simon (Stanford-Binet, 1916). Genetic Studies of Genius longitudinal sample.",
    "wechsler": "David Wechsler. Wechsler-Bellevue (1939) → WAIS (1955) → WAIS-IV (2008) → WAIS-5 (2024). Deviation IQ (M=100, SD=15). Verbal + performance; later four indices.",
    "spearman": "Charles Spearman (1904). Two-factor theory of intelligence: g (general) + s (specific). Factor analysis pioneer.",
    "thurstone": "Louis Thurstone. Primary mental abilities (7 PMAs); against pure g.",
    "cattell-horn": "Raymond Cattell + John Horn. Fluid (Gf) vs crystallised (Gc) intelligence.",
    "carroll": "John B. Carroll. Three-stratum theory; integrated into CHC (Cattell-Horn-Carroll) model.",
    "gardner": "Howard Gardner. Multiple intelligences (linguistic, logical-math, spatial, musical, bodily-kinaesthetic, interpersonal, intrapersonal, naturalist, existential).",
    "sternberg": "Robert Sternberg. Triarchic theory (analytical, creative, practical); WICS; triangular theory of love.",
    "goleman": "Daniel Goleman. Popularised emotional intelligence (1995). EI ≠ Mayer-Salovey ability EI; trait/mixed model.",
    "mayer-salovey": "Peter Salovey & John Mayer. Ability model of emotional intelligence (1990); MSCEIT.",

    /* Mirror-neuron / motor-system specific (the rizzolatti page) */
    "mirror neurons": "Neurons that fire both when an individual performs a goal-directed action and when they observe another performing it. Discovered by Rizzolatti's Parma group in macaque area F5 (early 1990s). Proposed substrate for action understanding, imitation, empathy and theory of mind. Human homologues: inferior frontal gyrus + inferior parietal lobule + superior temporal sulcus.",
    "f5": "Area F5 of the macaque premotor cortex. Where mirror neurons were first recorded. Houses both canonical neurons (object-shape coding) and mirror neurons.",
    "canonical neurons": "Premotor F5 neurons that fire when a graspable object of a particular shape is seen, even without movement. The 'sister population' to mirror neurons.",
    "premotor cortex": "Lateral BA 6. Plans externally-cued, visually-guided movement (vs SMA, internally generated).",
    "corticospinal tract": "Pyramidal tract. M1 → internal capsule → cerebral peduncle → medullary pyramid → decussates (~85%) → lateral corticospinal tract → ventral horn motor neurons. Lesion above decussation = contralateral; below = ipsilateral.",
    "pyramidal decussation": "Crossing of ~85% of corticospinal fibres at the caudal medulla (pyramids), forming the lateral corticospinal tract. The remaining ~15% stay ipsilateral as the ventral corticospinal tract.",
    "basal ganglia": "Caudate + putamen (striatum) + globus pallidus (internal/external) + substantia nigra + subthalamic nucleus. Action selection. Direct pathway facilitates, indirect inhibits. Parkinson's (DA loss) → indirect dominant; Huntington's (striatal loss) → direct dominant.",
    "cerebellum": "Coordinates timing and accuracy of movement; motor learning; cognitive/affective via cerebro-cerebellar loops. Cerebellar lesion = DANISH.",

    /* Stress & misc */
    "gas": "General Adaptation Syndrome. Selye 1936. Alarm → Resistance → Exhaustion.",
    "ern": "Error-related negativity. Negative ERP peaking ~50–100 ms after an erroneous response. Generated by the ACC.",
    "mmn": "Mismatch negativity. Pre-attentive ERP component (~150–250 ms) to a deviant in a stream of standards. Auditory cortex generator. Reduced in schizophrenia.",
    "p300": "Positive ERP component ~300 ms after a task-relevant rare stimulus. Indexes attention/working memory. Reduced amplitude in schizophrenia, alcoholism.",
    "n400": "Negative ERP ~400 ms to semantic violations ('She buttered her bread with socks'). Kutas & Hillyard 1980. Indexes semantic processing.",
    "cnv": "Contingent negative variation. Slow negative shift between a warning and a target stimulus. Indexes anticipation/preparation."
  };

  /* Aliases: map common written forms to dictionary keys */
  var ALIASES = {
    "kayser-fleischer rings": "kf rings",
    "kayser fleischer rings": "kf rings",
    "rizzolatti's": "rizzolatti",
    "rizzolatti et al.": "rizzolatti",
    "rizzolatti et al": "rizzolatti",
    "rizzolatti and gallese": "rizzolatti",
    "di pellegrino, rizzolatti": "rizzolatti",
    "mirror neuron": "mirror neurons",
    "supplementary motor area": "sma",
    "pre-supplementary motor area": "presma",
    "presupplementary motor area": "presma",
    "default mode network": "dmn",
    "default-mode network": "dmn",
    "hypothalamic-pituitary-adrenal": "hpa",
    "hypothalamic-pituitary-adrenal axis": "hpa",
    "hpa axis": "hpa",
    "long-term potentiation": "ltp",
    "long term potentiation": "ltp",
    "long-term depression": "ltd",
    "action potential": "ap",
    "event-related potential": "erp",
    "event related potential": "erp",
    "functional magnetic resonance imaging": "fmri",
    "supplementary motor area (sma)": "sma",
    "ventral tegmental area": "vta",
    "nucleus accumbens": "nacc",
    "substantia nigra": "snc",
    "locus coeruleus": "lc",
    "dorsal raphe": "drn",
    "suprachiasmatic nucleus": "scn",
    "paraventricular nucleus": "pvn",
    "arcuate nucleus": "arc",
    "lateral hypothalamus": "lh",
    "ventromedial hypothalamus": "vmh",
    "medial temporal lobe": "mtl",
    "dentate gyrus": "dg",
    "entorhinal cortex": "ec",
    "anterior cingulate": "acc",
    "posterior cingulate": "pcc",
    "primary motor cortex": "m1",
    "primary visual cortex": "v1",
    "primary auditory cortex": "a1",
    "primary somatosensory cortex": "s1",
    "ventromedial prefrontal cortex": "vmpfc",
    "orbitofrontal cortex": "ofc",
    "dorsolateral prefrontal cortex": "dlpfc",
    "inferior frontal gyrus": "ifg",
    "inferior parietal lobule": "ipl",
    "superior temporal sulcus": "sts",
    "norepinephrine": "ne",
    "noradrenaline": "ne",
    "dopamine": "da",
    "serotonin": "5-ht",
    "acetylcholine": "ach",
    "glutamate": "glu",
    "borderline personality disorder": "bpd",
    "major depressive disorder": "mdd",
    "generalised anxiety disorder": "gad",
    "generalized anxiety disorder": "gad",
    "obsessive-compulsive disorder": "ocd",
    "obsessive compulsive disorder": "ocd",
    "post-traumatic stress disorder": "ptsd",
    "posttraumatic stress disorder": "ptsd",
    "autism spectrum disorder": "asd",
    "attention-deficit/hyperactivity disorder": "adhd",
    "attention deficit hyperactivity disorder": "adhd",
    "schizophrenia": "sz",
    "transcranial magnetic stimulation": "tms",
    "transcranial direct current stimulation": "tdcs",
    "diffusion tensor imaging": "dti",
    "magnetoencephalography": "meg",
    "positron emission tomography": "pet",
    "electroencephalography": "eeg",
    "electroconvulsive therapy": "ect",
    "cognitive behavioural therapy": "cbt",
    "cognitive behavior therapy": "cbt",
    "cognitive behavioral therapy": "cbt",
    "dialectical behaviour therapy": "dbt",
    "dialectical behavior therapy": "dbt",
    "eye movement desensitisation and reprocessing": "emdr",
    "interpersonal psychotherapy": "ipt",
    "acceptance and commitment therapy": "act",
    "general adaptation syndrome": "gas",
    "mismatch negativity": "mmn",
    "error-related negativity": "ern",
    "contingent negative variation": "cnv",
    "working memory": "wm",
    "long-term memory": "ltm",
    "short-term memory": "stm",
    "tip-of-the-tongue": "tot",
    "feeling of knowing": "fok",
    "rizzolatti": "rizzolatti",
    "premotor area": "premotor cortex",
    "area f5": "f5",
    "kf ring": "kf rings"
  };

  /* Abbreviations regex — used to wrap things like "SMA", "fMRI", "preSMA",
     "BDNF", "5-HT", "KF rings" when they appear in plain text (not inside
     <b>/<strong>, links, headings or code). We exclude single-letter All-caps
     starts of sentences via word-boundary + minimum length. */
  var ABBR_REGEX = new RegExp(
    "\\b(" +
      "preSMA|fMRI|SMA|M1|S1|V1|A1|IFG|IPL|STS|DLPFC|VMPFC|OFC|ACC|PCC|MFG|" +
      "DMN|VTA|SNc|NAcc|PAG|LC|DRN|SCN|PVN|ARC|LH|VMH|MTL|CA1|CA3|DG|EC|" +
      "NMDA|AMPA|GABA|GLU|5-HT|DA|NE|ACh|BDNF|CREB|LTP|LTD|EPSP|IPSP|AP|" +
      "CRH|ACTH|HPA|HPG|HPT|BOLD|PET|EEG|ERP|MEG|TMS|tDCS|DTI|CT|MRI|" +
      "WM|LTM|STM|TOT|FOK|DSM|ICD|OCD|PTSD|GAD|MDD|BPD|ASD|ADHD|SZ|" +
      "SSRI|SNRI|TCA|MAOI|ECT|CBT|DBT|EMDR|IPT|ACT|EPSE|SIADH|NMS|SS|" +
      "ANOVA|ANCOVA|MANOVA|RR|OR|HR|NNT|CI|SEM|SD|IQR|GAS|ERN|MMN|P300|N400|CNV|F5" +
    ")\\b",
    "g"
  );

  /* Special phrases that aren't word-boundary friendly */
  var PHRASE_REGEX = /\bKF rings?\b|\bBOLD signal\b/g;

  /* -------------------- 2. WRAP CONTENT -------------------- */

  var root = document.querySelector("main") ||
             document.querySelector(".wrap") ||
             document.body;
  if (!root) return;

  var SKIP_TAGS = { SCRIPT:1, STYLE:1, NOSCRIPT:1, TEXTAREA:1, INPUT:1, CODE:1, PRE:1, A:1, BUTTON:1, MARK:1, NAV:1, H1:1, H2:1, H3:1, H4:1, H5:1, H6:1 };

  function isSkippable(node) {
    var p = node.parentNode;
    while (p && p !== root) {
      if (SKIP_TAGS[p.tagName]) return true;
      if (p.classList && (p.classList.contains("tp-term") || p.classList.contains("jump") || p.classList.contains("tp-skip"))) return true;
      p = p.parentNode;
    }
    return false;
  }

  /* (a) Wrap <b> and <strong> contents as tappable terms */
  function wrapBoldTerms() {
    var boldTags = root.querySelectorAll("b, strong");
    boldTags.forEach(function (b) {
      /* Skip if already wrapped, inside a link/heading, or empty */
      if (b.querySelector(".tp-term")) return;
      if (b.closest("a, h1, h2, h3, h4, h5, h6, nav, button, .tp-skip")) return;
      var txt = (b.textContent || "").trim();
      if (!txt || txt.length > 80) return; /* skip very long bolded blocks */
      /* Only wrap if it has any letters */
      if (!/[a-zA-Z]/.test(txt)) return;

      /* Wrap the bold's existing contents in a span */
      var span = document.createElement("span");
      span.className = "tp-term tp-bold";
      span.setAttribute("data-term", txt);
      span.setAttribute("role", "button");
      span.setAttribute("tabindex", "0");
      while (b.firstChild) span.appendChild(b.firstChild);
      b.appendChild(span);
    });
  }

  /* (b) Walk text nodes and wrap abbreviations in inline spans */
  function wrapAbbreviations() {
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) {
        if (!n.nodeValue || !n.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
        if (isSkippable(n)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    var nodes = [];
    var cur;
    while ((cur = walker.nextNode())) nodes.push(cur);

    nodes.forEach(function (node) {
      var text = node.nodeValue;
      ABBR_REGEX.lastIndex = 0;
      PHRASE_REGEX.lastIndex = 0;
      if (!ABBR_REGEX.test(text) && !PHRASE_REGEX.test(text)) return;
      ABBR_REGEX.lastIndex = 0;
      PHRASE_REGEX.lastIndex = 0;

      /* Build a fragment that splits text around matches */
      var combined = new RegExp("(" + ABBR_REGEX.source + "|" + PHRASE_REGEX.source + ")", "g");
      var parts = text.split(combined);
      if (parts.length <= 1) return;

      var frag = document.createDocumentFragment();
      parts.forEach(function (part) {
        if (!part) return;
        combined.lastIndex = 0;
        if (new RegExp("^(?:" + ABBR_REGEX.source + "|" + PHRASE_REGEX.source + ")$").test(part)) {
          var span = document.createElement("span");
          span.className = "tp-term tp-abbr";
          span.setAttribute("data-term", part);
          span.setAttribute("role", "button");
          span.setAttribute("tabindex", "0");
          span.textContent = part;
          frag.appendChild(span);
        } else {
          frag.appendChild(document.createTextNode(part));
        }
      });
      node.parentNode.replaceChild(frag, node);
    });
  }

  /* -------------------- 3. LOOKUP DEFINITION -------------------- */

  function normalise(s) {
    return (s || "")
      .toLowerCase()
      .replace(/[–—]/g, "-") /* en/em dash to hyphen */
      .replace(/['"`]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function lookupDef(term) {
    var key = normalise(term);
    if (TERM_DEFS[key]) return { def: TERM_DEFS[key], source: "dictionary" };
    if (ALIASES[key] && TERM_DEFS[ALIASES[key]]) {
      return { def: TERM_DEFS[ALIASES[key]], source: "dictionary" };
    }
    /* try without trailing 's' */
    if (key.endsWith("s") && TERM_DEFS[key.slice(0, -1)]) {
      return { def: TERM_DEFS[key.slice(0, -1)], source: "dictionary" };
    }
    /* try without trailing apostrophe-s */
    var keyNoPoss = key.replace(/'s$/, "").replace(/s$/, "");
    if (TERM_DEFS[keyNoPoss]) return { def: TERM_DEFS[keyNoPoss], source: "dictionary" };

    return null;
  }

  /* Find a "defining occurrence" of the term on this page. We look for an
     <li> or <p> where the term (or one of its alias keys) is bolded and
     followed by a dash-or-colon definition. */
  function findOnPageDef(term) {
    var needle = normalise(term);
    if (!needle) return null;

    var candidates = root.querySelectorAll("li, p, dt, dd, td");
    var best = null;
    for (var i = 0; i < candidates.length; i++) {
      var el = candidates[i];
      var b = el.querySelector("b, strong");
      if (!b) continue;
      var btext = normalise(b.textContent);
      if (btext === needle || btext.indexOf(needle) !== -1 || needle.indexOf(btext) !== -1) {
        var full = el.textContent.replace(/\s+/g, " ").trim();
        if (full.length > 20 && full.length < 600) {
          best = full;
          break;
        }
        if (!best && full.length < 1200) best = full;
      }
    }
    if (best) return { def: best, source: "from this page" };
    return null;
  }

  /* -------------------- 4. POPOVER UI -------------------- */

  var backdrop = document.createElement("div");
  backdrop.id = "tp-popover-backdrop";
  document.body.appendChild(backdrop);

  var pop = document.createElement("div");
  pop.id = "tp-popover";
  pop.setAttribute("role", "dialog");
  pop.setAttribute("aria-modal", "false");
  pop.innerHTML =
    '<div class="tp-pop-head">' +
      '<div class="tp-pop-term"></div>' +
      '<button class="tp-pop-close" aria-label="Close">&times;</button>' +
    '</div>' +
    '<div class="tp-pop-body"></div>' +
    '<div class="tp-pop-source"></div>';
  document.body.appendChild(pop);

  var hint = document.createElement("div");
  hint.id = "tp-hint";
  hint.textContent = "tip: tap any bolded term for a definition";
  document.body.appendChild(hint);
  /* Hide hint after first interaction */
  function hideHint() { hint.classList.add("tp-hide"); try { sessionStorage.setItem("tp-hint-seen", "1"); } catch(e) {} }
  hint.addEventListener("click", hideHint);
  try { if (sessionStorage.getItem("tp-hint-seen")) hint.classList.add("tp-hide"); } catch(e) {}

  var activeTerm = null;
  function closePopover() {
    pop.classList.remove("tp-show");
    backdrop.classList.remove("tp-show");
    if (activeTerm) activeTerm.classList.remove("tp-active");
    activeTerm = null;
  }

  function positionPopover(targetRect) {
    var W = window.innerWidth, H = window.innerHeight;
    var popW = pop.offsetWidth || 360;
    var popH = pop.offsetHeight || 160;
    /* Default: under the target, left-aligned */
    var top = targetRect.bottom + 8;
    var left = targetRect.left;
    if (left + popW > W - 12) left = W - popW - 12;
    if (left < 12) left = 12;
    /* If not enough room below, go above */
    if (top + popH > H - 12 && targetRect.top > popH + 16) {
      top = targetRect.top - popH - 8;
    }
    if (top < 12) top = 12;
    pop.style.top = top + "px";
    pop.style.left = left + "px";
  }

  function openPopover(termEl) {
    var raw = termEl.getAttribute("data-term") || termEl.textContent || "";
    var term = raw.trim().replace(/[—–:.,;]+$/, "");
    var lookup = lookupDef(term) || findOnPageDef(term);

    pop.querySelector(".tp-pop-term").textContent = term;
    var body = pop.querySelector(".tp-pop-body");
    var source = pop.querySelector(".tp-pop-source");
    if (lookup) {
      body.textContent = lookup.def;
      source.textContent = lookup.source === "dictionary"
        ? "from the built-in glossary"
        : "from this page";
    } else {
      body.innerHTML = '<em>No definition stored yet for this term. It’s bolded on this page as a key term — open the cheatsheets or master glossary for context.</em>';
      source.textContent = "no match found";
    }

    if (activeTerm) activeTerm.classList.remove("tp-active");
    termEl.classList.add("tp-active");
    activeTerm = termEl;

    pop.classList.add("tp-show");
    backdrop.classList.add("tp-show");
    /* needs to be visible to measure */
    pop.style.top = "-9999px";
    pop.style.left = "-9999px";
    requestAnimationFrame(function () {
      positionPopover(termEl.getBoundingClientRect());
    });
    hideHint();
  }

  /* Event delegation: tap a tp-term to open */
  root.addEventListener("click", function (e) {
    var t = e.target.closest(".tp-term");
    if (!t) return;
    e.preventDefault();
    e.stopPropagation();
    /* re-tap on same active term closes */
    if (t === activeTerm) {
      closePopover();
      return;
    }
    openPopover(t);
  });

  /* Keyboard: enter/space activates */
  root.addEventListener("keydown", function (e) {
    if (e.key !== "Enter" && e.key !== " ") return;
    var t = e.target.closest(".tp-term");
    if (!t) return;
    e.preventDefault();
    openPopover(t);
  });

  /* Tap outside closes */
  document.addEventListener("click", function (e) {
    if (!pop.classList.contains("tp-show")) return;
    if (pop.contains(e.target)) return;
    if (e.target.closest(".tp-term")) return; /* root handler runs */
    closePopover();
  });
  backdrop.addEventListener("click", closePopover);
  pop.querySelector(".tp-pop-close").addEventListener("click", function (e) {
    e.stopPropagation();
    closePopover();
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") closePopover();
  });
  /* Reposition on resize/scroll while open */
  function reposition() {
    if (!pop.classList.contains("tp-show") || !activeTerm) return;
    positionPopover(activeTerm.getBoundingClientRect());
  }
  window.addEventListener("resize", reposition);
  window.addEventListener("scroll", reposition, { passive: true });

  /* -------------------- 5. INIT -------------------- */

  function init() {
    /* Inject CSS if it isn't on the page yet (defensive — pages should
       already include term-popover.css, but this keeps it working if a
       page forgot it). */
    if (!document.querySelector('link[href*="term-popover.css"]') &&
        !document.getElementById("tp-inline-style")) {
      var link = document.createElement("link");
      link.rel = "stylesheet";
      link.id = "tp-popover-link";
      /* Resolve relative to this script's path */
      var scripts = document.getElementsByTagName("script");
      var here = null;
      for (var i = 0; i < scripts.length; i++) {
        var src = scripts[i].src || "";
        if (src.indexOf("term-popover.js") !== -1) { here = src; break; }
      }
      link.href = here ? here.replace(/term-popover\.js.*$/, "term-popover.css")
                       : "/sihan-met-flashcards/notes/term-popover.css";
      document.head.appendChild(link);
    }
    wrapBoldTerms();
    wrapAbbreviations();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
