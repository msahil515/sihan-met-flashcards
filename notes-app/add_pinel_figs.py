#!/usr/bin/env python3
"""The figures pass for the full-depth Pinel book.

Drops the real Pinel & Barnes figures into merged/pinel.html, anchored to the
sub-heading each one belongs under. Idempotent: it strips every existing
<figure class="bfig"> block first, so re-running after an edit to PLAN just
re-lays them out.

Sources
  - 22 figures already cropped for notes/biopsych-cheatsheet/figs/
  - 41 more cropped straight out of the 11th-ed PDF (see /tmp/extract_figs.py)
Both sets now live in notes-app/figs/pinel/ and are referenced from the reader
pages in notes-app/content/, hence the ../figs/ prefix.

Run:  python3 add_pinel_figs.py && python3 build_app.py
"""
import os, re, sys

ROOT = os.path.dirname(os.path.abspath(__file__))
BOOK = os.path.join(ROOT, "merged", "pinel.html")
FIGDIR = os.path.join(ROOT, "figs", "pinel")

CREDIT = "Pinel &amp; Barnes, <i>Biopsychology</i>, 11th ed."

# anchor sub-heading (exact <h3> text)  ->  [(figure number, caption), ...]
# order within a list is the order they appear under that heading
PLAN = [
    # ---- Chapter 1 ----
    ("The six divisions of biopsychology", [
        ("1.4", "The six divisions of biopsychology, and how they overlap.")]),
    ("Scientific inference: how you study something you cannot see", [
        ("1.3", "Lester and Gorzalka (1988): the design and the result that ruled out fatigue as the explanation of the Coolidge effect.")]),
    # ---- Chapter 2 ----
    ("Fundamental genetics, built up", [
        ("2.16", "The structure of DNA, with the complementary base pairs that make replication possible."),
        ("2.18", "Gene expression: transcription of DNA into mRNA, then translation of mRNA into a protein.")]),
    ("Behavioural genetics: the experiments that settle the interaction", [
        ("2.19", "The two epigenetic mechanisms that do most of the work: DNA methylation and histone remodelling."),
        ("2.21", "Tryon's maze-bright and maze-dull rats did not differ when both strains were reared in an enriched environment.")]),
    # ---- Chapter 3 ----
    ("The coordinate system, and why it bends in humans", [
        ("3.16", "Horizontal, frontal (coronal) and sagittal planes.")]),
    ("The major divisions", [
        ("3.2", "The major divisions of the nervous system.")]),
    ("The cells: neurons and glia", [
        ("3.5", "External features of a neuron."),
        ("3.6", "Internal features of a neuron."),
        ("3.8", "Unipolar, bipolar and multipolar neurons, and an interneuron."),
        ("3.9", "Myelination: an oligodendrocyte in the CNS, a Schwann cell in the PNS.")]),
    ("The five divisions of the brain", [
        ("3.19", "The five divisions of the adult human brain.")]),
    ("Cortex, limbic system and basal ganglia", [
        ("3.25", "The lobes of the cerebral hemisphere."),
        ("3.27", "The limbic system."),
        ("3.28", "The basal ganglia.")]),
    # ---- Chapter 4 ----
    ("The action potential, step by step", [
        ("4.5", "Na⁺ and K⁺ channels across the three phases of the action potential.")]),
    ("The synapse: structure", [
        ("4.7", "Anatomy of a typical synapse.")]),
    ("The transmitters themselves", [
        ("4.16", "The classes of neurotransmitters.")]),
    # ---- Chapter 5 ----
    ("Visualising the living human brain", [
        ("5.22", "The default mode network: what lights up when the mind wanders rather than when it is on task.")]),
    ("Recording human psychophysiological activity", [
        ("5.8", "Typical electroencephalograms and their psychological correlates."),
        ("5.10", "An average auditory evoked potential, and the P300 that appears only when the stimulus means something.")]),
    ("Invasive physiological methods", [
        ("5.17", "The four ways of recording electrical activity, from one neuron to the whole scalp.")]),
    # ---- Chapter 6 ----
    ("The retina, and its counter-intuitive design", [
        ("6.5", "The cellular structure of the retina.")]),
    ("From eye to cortex: the retina-geniculate-striate pathway", [
        ("6.13", "The retina-geniculate-striate pathway.")]),
    # ---- Chapter 7 ----
    ("Audition: from air pressure to pitch", [
        ("7.4", "Anatomy of the ear.")]),
    ("The somatosensory system: touch, and the two ascending routes", [
        ("7.10", "The dorsal-column medial-lemniscus system."),
        ("7.11", "The anterolateral system.")]),
    # ---- Chapter 8 ----
    ("Three principles, and one that follows from practice", [
        ("8.1", "The sensorimotor system as a hierarchy.")]),
    ("Primary motor cortex, and what its map really represents", [
        ("8.6", "The motor homunculus.")]),
    # ---- Chapter 9 ----
    ("The five phases", [
        ("9.3", "How the neural plate becomes the neural tube, across weeks three and four."),
        ("9.8", "Sperry's eye-rotation experiment, the evidence for chemoaffinity.")]),
    ("Experience: what it does and when", [
        ("9.11", "A few days of early monocular deprivation: axons from the deprived eye branch far less in layer IV.")]),
    # ---- Chapter 10 ----
    ("Six causes of brain damage", [
        ("10.5", "The cascade by which ischemia-induced glutamate release kills neurons.")]),
    ("Five neuropsychological diseases", [
        ("10.14", "The neuropathology of Alzheimer's disease, microscopic and gross.")]),
    ("How the brain responds to damage: degeneration, regeneration, reorganisation", [
        ("10.15", "Neural and transneuronal degeneration following axotomy.")]),
    ("Phantom limbs and the logic of treatment", [
        ("10.22", "Where a touch on Carlos's face produced a sensation in his phantom hand.")]),
    # ---- Chapter 11 ----
    ("H.M., and the five things his case established", [
        ("11.5", "Retrograde and anterograde amnesia after a closed-head injury.")]),
    ("Animal models, and the isolation of the hippocampus", [
        ("11.4", "The major components of the hippocampus.")]),
    # ---- Chapter 12 ----
    ("Digestion and the flow of energy", [
        ("12.3", "The cephalic, absorptive and fasting phases, and what insulin and glucagon do in each.")]),
    ("Physiology: hypothalamic centres, then the honest correction", [
        ("12.6", "The ventromedial and lateral hypothalamus in the rat brain.")]),
    ("Body-weight regulation: settling point rather than set point", [
        ("12.10", "The leaky-barrel model: a settling point, not a set point.")]),
    # ---- Chapter 13 ----
    ("The pituitary, and who is actually in charge", [
        ("13.4", "How the hypothalamus controls the anterior and the posterior pituitary, by two different routes.")]),
    ("Sexual development: one program with switches", [
        ("13.7", "Wolffian and Müllerian systems: the internal ducts, and the switch that picks one."),
        ("13.8", "The external reproductive organs, both developing from the same bipotential precursor.")]),
    # ---- Chapter 14 ----
    ("Measuring sleep: three signals and five stages", [
        ("14.2", "The EEG of alert wakefulness, of sleep onset, and of the three stages of sleep."),
        ("14.3", "The course of the EEG stages across a typical night, with REM and the loss of core-muscle tone.")]),
    ("Circadian rhythms and the clock", [
        ("14.8", "A free-running sleep-wake cycle of 25.3 hours, with no time cues at all."),
        ("14.9", "Location of the suprachiasmatic nuclei.")]),
    # ---- Chapter 15 ----
    ("Basic pharmacological principles", [
        ("15.1", "Tolerance as a rightward shift of the dose-response curve.")]),
    ("The reward circuit, and what dopamine actually signals", [
        ("15.7", "The mesotelencephalic dopamine system: nigrostriatal pathway in green, mesocorticolimbic in red.")]),
    ("Three theories of addiction", [
        ("15.10", "The three stages in the development of an addiction.")]),
    # ---- Chapter 16 ----
    ("The split brain", [
        ("16.4", "Myers and Sperry (1953): the four groups, and the result that made the split brain a research programme."),
        ("16.5", "The testing procedure for split-brain patients: one visual field, one hemisphere, one hand."),
        ("16.6", "The chimeric figures test, and what each hemisphere reports seeing.")]),
    ("Localising language: the Wernicke-Geschwind model and its problems", [
        ("16.8", "The seven components of the Wernicke-Geschwind model, all in the left hemisphere.")]),
    # ---- Chapter 17 ----
    ("Darwin, and the three classical theories", [
        ("17.3", "Four ways of relating the perception of a stimulus, the bodily reaction, and the feeling: the commonsense, James-Lange, Cannon-Bard and modern views.")]),
    ("Fear conditioning, and the two roads to the amygdala", [
        ("17.9", "The structures mediating the sympathetic and behavioural responses conditioned to a sound.")]),
    ("Expression: universality, and the muscles that give it away", [
        ("17.5", "Ekman's six primary facial expressions.")]),
    ("Stress", [
        ("17.12", "The two-system view of the stress response: the anterior-pituitary-adrenal-cortex route and the sympathetic-adrenal-medulla route.")]),
    # ---- Chapter 18 ----
    ("Schizophrenia", [
        ("18.1", "Chlorpromazine as a receptor blocker at dopamine synapses."),
        ("18.2", "Antipsychotic potency plotted against D₂ binding: the correlation that made the dopamine theory.")]),
    ("Depression and bipolar disorder", [
        ("18.3", "How fluoxetine blocks serotonin reuptake.")]),
]

BLOCK = ('<figure class="bfig" id="fig-{sid}">'
         '<a href="../figs/pinel/f_{sid}.jpg" target="_blank" rel="noopener">'
         '<img src="../figs/pinel/f_{sid}.jpg" loading="lazy" alt="Pinel Figure {num}: {alt}"></a>'
         '<figcaption><b>{cap}</b> <span>{credit} &middot; Fig&nbsp;{num}</span></figcaption>'
         '</figure>')


def main():
    with open(BOOK, encoding="utf-8") as f:
        doc = f.read()

    # idempotent: clear any previous pass
    doc = re.sub(r'<div class="bfigs">.*?</div>\n?', '', doc, flags=re.S)

    placed, missing_file, missing_anchor = 0, [], []
    for heading, figs in PLAN:
        blocks = []
        for num, cap in figs:
            sid = num.replace(".", "_")
            if not os.path.isfile(os.path.join(FIGDIR, f"f_{sid}.jpg")):
                missing_file.append(num)
                continue
            alt = re.sub(r'<[^>]+>', '', cap).rstrip('.')
            blocks.append(BLOCK.format(sid=sid, num=num, cap=cap, alt=alt, credit=CREDIT))
        if not blocks:
            continue

        pat = re.compile(r'(<h3[^>]*>' + re.escape(heading) + r'</h3>)')
        if not pat.search(doc):
            missing_anchor.append(heading)
            continue
        doc = pat.sub(lambda m: m.group(1) + '\n<div class="bfigs">' + ''.join(blocks) + '</div>\n',
                      doc, count=1)
        placed += len(blocks)

    with open(BOOK, "w", encoding="utf-8") as f:
        f.write(doc)

    print(f"placed {placed} figures across {len(PLAN)} anchors")
    if missing_file:
        print("MISSING IMAGE FILES:", missing_file)
    if missing_anchor:
        print("ANCHOR NOT FOUND:", missing_anchor)
    return 1 if (missing_file or missing_anchor) else 0


if __name__ == "__main__":
    sys.exit(main())
