#!/usr/bin/env python3
"""The figures pass for the full-depth Pinel book.

Drops the real Pinel & Barnes figures into merged/pinel.html, anchored to the
sub-heading each one belongs under. Idempotent: it strips every existing
<figure class="bfig"> block first, so re-running after an edit to PLAN just
re-lays them out.

Sources
  - 22 figures already cropped for notes/biopsych-cheatsheet/figs/
  - 287 more cropped straight out of the 11th-ed PDF (see /tmp/extract_all_figs.py).
    That is every numbered figure in the book, 309 of them, none skipped.
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
    ("The founding text: Hebb, 1949", [
        ("1.1", "The human brain: Appearances can be deceiving!"),
    ]),
    ("The six divisions of biopsychology", [
        ("1.4", "The six divisions of biopsychology, and how they overlap."),
        ("1.5", "Visual tracking of a pendulum by a healthy control participant (top) and three participants with schizophrenia."),
        ("1.6", "Functional brain imaging is the major method of cognitive neuroscience. This image\u2014taken from the top of the head with the participant lying on her back\u2014reveals the locations of high levels of neural activity at one level of the brain as th\u2026"),
    ]),
    ("Scientific inference: how you study something you cannot see", [
        ("1.2", "President Calvin Coolidge and Mrs. Grace Coolidge. Many students think the Coolidge effect is named after a biopsychologist named Coolidge. In fact, it is named after President Calvin Coolidge, of whom the following story is told."),
        ("1.3", "Lester and Gorzalka (1988): the design and the result that ruled out fatigue as the explanation of the Coolidge effect."),
        ("1.7", "The perception of motion under four different conditions."),
    ]),
    ("Critical thinking about biopsychological claims", [
        ("1.8", "The right and left prefrontal lobes, whose connections to the rest of the brain are disrupted by prefrontal lobotomy."),
        ("1.9", "The prefrontal lobotomy procedure developed by Moniz and Lima."),
        ("1.10", "The transorbital procedure for performing prefrontal lobotomy."),
    ]),
    # ---- Chapter 2 ----
    ("The two flawed dichotomies", [
        ("2.3", "A schematic illustration of the way in which most biopsychologists think about the biology of behavior."),
    ]),
    ("Natural selection, and what it actually says", [
        ("2.1", "Asomatognosia often involves damage to the right frontal and parietal lobes."),
        ("2.2", "The reactions of chimpanzees to their own images suggest that they are self-aware. In this photo, the chimpanzee is reacting to the bright red, odorless dye that was painted on its eyebrow ridge while it was anesthetized."),
        ("2.4", "Four kinds of evidence supporting the theory that species evolve."),
        ("2.5", "Two massive bull elephant seals challenge one another. Dominant bull elephant seals copulate more frequently than those lower in the dominance hierarchy."),
    ]),
    ("The course of human evolution, and the brain", [
        ("2.6", "A recently discovered fossil of a missing evolutionary link is shown on the right, and a reconstruction of the creature is shown on the left."),
        ("2.7", "Species from five different groups of primates."),
        ("2.8", "A comparison of the feet and hands of a human and a chimpanzee."),
        ("2.9", "). Hominins include six sub-groups including Australopithecus and Homo."),
        ("2.10", "The remarkably complete skull of a 3-yearold Australopithecus girl; the fossil is 3.3 million years old."),
        ("2.11", "Fossilized footprints of Australopithecine hominins who strode across African volcanic ash about 3.6 million years ago, leaving a 70-meter trail. There were two adults and a child; the child often walked in the footsteps of the adults."),
        ("2.12", "Hominin evolution."),
        ("2.13", "The brains of animals of different evolutionary ages\u2014cerebrums are shown in pink; brain stems are shown in orange."),
    ]),
    ("Fundamental genetics, built up", [
        ("2.14", "How Mendel\u2019s theory accounts for the results of his experiment on the inheritance of seed color in pea plants."),
        ("2.15", "During fertilization, sperm cells attach themselves to the surface of an egg cell; at least one must enter the egg cell to fertilize it."),
        ("2.16", "The structure of DNA, with the complementary base pairs that make replication possible."),
        ("2.17", "DNA replication. As the two strands of the original DNA molecule unwind, the nucleotide bases on each strand attract free-floating complementary bases."),
        ("2.18", "Gene expression: transcription of DNA into mRNA, then translation of mRNA into a protein."),
    ]),
    ("Behavioural genetics: the experiments that settle the interaction", [
        ("2.19", "The two epigenetic mechanisms that do most of the work: DNA methylation and histone remodelling."),
        ("2.20", "Selective breeding of maze-bright and maze-dull strains of rats by Tryon (1934)."),
        ("2.21", "Tryon's maze-bright and maze-dull rats did not differ when both strains were reared in an enriched environment."),
        ("2.22", "Epigenetic research suggests that the common practice of referring to monozygotic twins as \u201cidentical twins\u201d is no longer appropriate."),
    ]),
    # ---- Chapter 3 ----
    ("The coordinate system, and why it bends in humans", [
        ("3.15", "(a) Anatomical directions in representative vertebrates, my (JP) cats Sambala and Rastaman. (b) Anatomical directions in a human."),
        ("3.16", "Horizontal, frontal (coronal) and sagittal planes."),
    ]),
    ("The major divisions", [
        ("3.1", "The human central nervous system (CNS) and peripheral nervous system (PNS). The CNS is represented in red; the PNS in orange. Notice that even those portions of nerves that are within the spinal cord are considered to be part of the PNS."),
        ("3.2", "The major divisions of the nervous system."),
        ("3.29", "Summary of major brain structures."),
    ]),
    ("Protection: meninges, cerebrospinal fluid, and the blood-brain barrier", [
        ("3.3", "The cerebral ventricles and central canal."),
        ("3.4", "The absorption of cerebrospinal fluid (CSF) from the subarachnoid space (blue) into a major sinus. Note the three meninges."),
    ]),
    ("The cells: neurons and glia", [
        ("3.5", "External features of a neuron."),
        ("3.6", "Internal features of a neuron."),
        ("3.7", "The cell membrane is a lipid bilayer with signal proteins and channel proteins embedded in it."),
        ("3.8", "Unipolar, bipolar and multipolar neurons, and an interneuron."),
        ("3.9", "Myelination: an oligodendrocyte in the CNS, a Schwann cell in the PNS."),
        ("3.10", "Astrocytes (shown in pink) have an affinity for blood vessels (in red) and they also make contact with neurons (in blue)."),
        ("3.13", "A color-enhanced scanning electron micrograph of a neuron cell body (green) studded with terminal buttons (orange). Each neuron receives numerous synaptic contacts."),
    ]),
    ("Seeing the structures: neuroanatomical techniques", [
        ("3.11", "Neural tissue that has been stained by the Golgi method. Because only a few neurons take up the stain, their silhouettes are revealed in great detail, but their internal details are invisible."),
        ("3.12", "The Nissl stain. Presented here is a Nissl-stained section through the rat hippocampus, at two levels of magnification to illustrate two uses of Nissl stains."),
        ("3.14", "One example of anterograde tracing (A) and one example of retrograde tracing (B)."),
        ("3.30", "The art of neuroanatomical staining. This slide was stained with both a Golgi stain and a Nissl stain."),
    ]),
    ("The spinal cord", [
        ("3.17", "A schematic cross section of the spinal cord, and the dorsal and ventral roots."),
    ]),
    ("The five divisions of the brain", [
        ("3.18", "The early development of the mammalian brain illustrated in schematic horizontal sections. Compare with the adult human brain in Figure 3.19."),
        ("3.19", "The five divisions of the adult human brain."),
        ("3.20", "Structures of the human myelencephalon (medulla) and metencephalon."),
        ("3.21", "The human mesencephalon (midbrain)."),
        ("3.22", "The human diencephalon."),
        ("3.23", "The human hypothalamus (in color) in relation to the optic chiasm and the pituitary gland."),
    ]),
    ("Cortex, limbic system and basal ganglia", [
        ("3.24", "The major fissures of the human cerebral cortex."),
        ("3.25", "The lobes of the cerebral hemisphere."),
        ("3.26", "The six layers of neocortex. The thickness of the cell layers can give a clue as to the function of an area of neocortex. For example, the thickness of layer IV indicates that this is sensory neocortex."),
        ("3.27", "The limbic system."),
        ("3.28", "The basal ganglia."),
    ]),
    # ---- Chapter 4 ----
    ("The resting potential, and the four forces that produce it", [
        ("4.1", "Three factors that influence the distribution of Na+ and K+ ions across neural membranes, illustrated in a resting neuron."),
    ]),
    ("Postsynaptic potentials and integration", [
        ("4.2", "An EPSP, an IPSP, and an EPSP followed by an AP."),
        ("4.3", "The three possible combinations of spatial summation."),
        ("4.4", "The two possible combinations of temporal summation."),
    ]),
    ("The action potential, step by step", [
        ("4.5", "Na\u207a and K\u207a channels across the three phases of the action potential."),
    ]),
    ("Conduction along the axon, and why myelin matters", [
        ("4.6", "The usual direction of signals conducted through a multipolar neuron (i.e., orthodromic conduction)."),
    ]),
    ("The synapse: structure", [
        ("4.7", "Anatomy of a typical synapse."),
        ("4.8", "Presynaptic facilitation and inhibition."),
        ("4.9", "One example of nondirected neurotransmitter release. Some neurons release neurotransmitter molecules diffusely from varicosities along the axon and its branches."),
        ("4.13", "Gap junctions connect the cytoplasm of two adjacent cells. In the mammalian brain, there are many gap junctions between glial cells, between neurons, and between neurons and glia cells."),
        ("4.14", "String-of-beads noradrenergic nerve fibers. The bright, beaded structures represent sites in these axons where the monoamine neurotransmitter norepinephrine is stored and released into the surrounding extracellular fluid."),
    ]),
    ("The synapse: the transmission cycle", [
        ("4.10", "Schematic illustration of exocytosis."),
        ("4.11", "Ionotropic and metabotropic receptors."),
        ("4.12", "The two mechanisms for terminating neurotransmitter action in the synapse: reuptake and enzymatic degradation."),
        ("4.17", "Seven steps in neurotransmitter action: (1) synthesis, (2) storage in vesicles, (3) breakdown of any neurotransmitter leaking from the vesicles, (4) exocytosis, (5) inhibitory feedback via autoreceptors"),
    ]),
    ("The transmitters themselves", [
        ("4.15", "The steps in the synthesis of catecholamines from tyrosine."),
        ("4.16", "The classes of neurotransmitters."),
    ]),
    ("Drugs: how every psychoactive drug does what it does", [
        ("4.18", "Some mechanisms of agonistic and antagonistic drug effects."),
        ("4.19", "Receiving cosmetic Botox injections."),
    ]),
    # ---- Chapter 5 ----
    ("Visualising the living human brain", [
        ("5.1", "A cerebral angiogram of a healthy human."),
        ("5.2", "Computed tomography (CT) uses x-rays to create a brain scan."),
        ("5.3", "A pair of PET scans. A scan was done when the volunteer\u2019s eyes were either open (left) or closed (right). Areas of high activity are indicated by reds and yellows."),
        ("5.4", "A color-enhanced midsagittal MRI scan."),
        ("5.5", "MRI of a growing tumor. The tumor is colored red."),
        ("5.6", "Diffusion tensor MRI. This three-dimensional image shows the major tracts of the brain."),
        ("5.7", "Functional magnetic resonance image (fMRI). This image illustrates the areas of cortex that became more active when the volunteers observed strings of letters and were required to specify which strings were words\u2014in the control condition"),
        ("5.11", "A magnetoencephalography (MEG) machine. Stylish in any home!"),
        ("5.22", "The default mode network: what lights up when the mind wanders rather than when it is on task."),
    ]),
    ("Recording human psychophysiological activity", [
        ("5.8", "Typical electroencephalograms and their psychological correlates."),
        ("5.9", "Signal averaging: Averaging of the background EEG (left) and of auditory evoked potentials (right). Averaging increases the signal-to-noise ratio."),
        ("5.10", "An average auditory evoked potential, and the P300 that appears only when the stimulus means something."),
        ("5.12", "The relation between a raw EMG signal and its integrated version. The volunteer tensed her muscle beneath the electrodes and then gradually relaxed it."),
        ("5.13", "The typical placement of electrodes around the eye for electrooculography. The two electrooculogram traces were recorded as the volunteer scanned a circle."),
    ]),
    ("Invasive physiological methods", [
        ("5.14", "A stereotaxic instrument. This one is meant for surgery on rodents."),
        ("5.15", "Stereotaxic surgery: Implanting an electrode in the rat amygdala."),
        ("5.16", "A device for performing subcortical knife cuts. The device is stereotaxically positioned in the brain; then the blade swings out to make the cut. Here, the anterior commissure is being sectioned."),
        ("5.17", "The four ways of recording electrical activity, from one neuron to the whole scalp."),
    ]),
    ("Pharmacological and genetic methods", [
        ("5.18", "The 2-deoxyglucose technique. The accumulation of radioactivity is shown in three frontal sections taken from the brain of a Richardson\u2019s ground squirrel."),
        ("5.19", "Immunocytochemistry. This section through a rat\u2019s pons reveals noradrenergic neurons that have attracted the antibody for dopamine-beta-hydroxylase, the enzyme that converts dopamine to norepinephrine."),
        ("5.20", "Touch receptor neurons of the transparent Caenorhabditis elegans labeled by green fluorescent protein."),
        ("5.21", "With the research technique called brainbow, each neuron is labeled with a different color, facilitating the tracing of neural axons."),
    ]),
    ("Behavioural research methods", [
        ("5.23", "A radial arm maze."),
        ("5.24", "These photos show a rat burying a test object from which it has just received a single mild shock."),
    ]),
    # ---- Chapter 6 ----
    ("Light, and the two properties that matter", [
        ("6.1", "The fortification illusions associated with migraine headaches."),
        ("6.2", "The electromagnetic spectrum and the colors that had been associated with wavelengths visible to humans."),
        ("6.3", "The human eye. Light enters the eye through the pupil, whose size is regulated by the iris. The iris gives the eye its characteristic color\u2014blue, brown, or other."),
        ("6.4", "The human eye, a product of approximately 600 million years of evolution."),
    ]),
    ("The retina, and its counter-intuitive design", [
        ("6.5", "The cellular structure of the retina."),
        ("6.6", "A section of the retina. The fovea is the indentation at the center of the retina; it is specialized for high-acuity vision."),
        ("6.7", "Cones and rods. The red colored cells are cones; the blue colored cells are rods."),
        ("6.12", "The inhibitory response of rods to light. When light bleaches rhodopsin molecules, the rods\u2019 sodium channels close; as a result, the rods become hyperpolarized and release less glutamate."),
    ]),
    ("Duplexity theory: two systems in one retina", [
        ("6.8", "Schematic representations of the convergence of cones or rods on a retinal ganglion cell. There is a low degree of convergence in cone-fed pathways and a high degree of convergence in rod-fed pathways."),
        ("6.9", "The distribution of cones and rods over the human retina. The figure illustrates the number of cones and rods per square millimeter as a function of distance from the center of the fovea."),
        ("6.10", "Human photopic (cone) and scotopic (rod) spectral sensitivity curves. The peak of each curve has been arbitrarily set at 100 percent."),
        ("6.11", "The absorption spectrum of rhodopsin compared with the human scotopic spectral sensitivity curve."),
    ]),
    ("From eye to cortex: the retina-geniculate-striate pathway", [
        ("6.13", "The retina-geniculate-striate pathway."),
        ("6.21", "The perimetric maps of a man with a bullet wound in his left primary visual cortex. The scotomas (areas of blindness) are indicated in purple."),
    ]),
    ("Receptive fields: what a visual neuron is actually for", [
        ("6.14", "The illusory bands visible in this figure are often called Mach bands, although Mach used a different figure to generate them in his studies (see Eagleman, 2001)."),
        ("6.15", "The receptive fields of an on-center cell and an off-center cell."),
        ("6.16", "The responses of an on-center cell to contrast."),
        ("6.17", "Examples of receptive fields of simple striate cells."),
    ]),
    ("Colour vision: two theories, both correct, at different levels", [
        ("6.18", "The absorption spectra of the three classes of cones."),
        ("6.19", "The method of Land\u2019s (1977) color-vision experiments. Participants viewed Mondrians illuminated by various proportions of three different wavelengths: a short wavelength, a middle wavelength, and a long wavelength."),
    ]),
    ("Beyond V1: two streams, and what their lesions look like", [
        ("6.20", "The visual areas of the human cerebral cortex."),
        ("6.22", "The completion of a migraine-induced scotoma, as described by Karl Lashley (1941)."),
        ("6.23", "Some of the visual areas that have been identified in the human brain."),
        ("6.24", "Information about particular aspects of a visual display flow out of the primary visual cortex over many pathways. The pathways can be grouped into two general streams: dorsal and ventral."),
        ("6.25", "The \u201cwhere\u201d versus \u201cwhat\u201d and the \u201ccontrol of behavior\u201d versus \u201cconscious perception\u201d theories make different predictions."),
        ("6.26", "The location of the fusiform face area (FFA), the occipital face area (OFA), and area MT. Damage to the FFA or OFA is associated with prosopagnosia. Damage to area MT is associated with akinetopsia."),
    ]),
    # ---- Chapter 7 ----
    ("Three principles that hold in every sensory system", [
        ("7.1", "Two models of sensory system organization: The former model was hierarchical, functionally homogeneous, and serial; the current model, which is more consistent with the evidence, is hierarchical, functionally segregated, and parallel."),
    ]),
    ("Audition: from air pressure to pitch", [
        ("7.2", "The relation between the physical and perceptual dimensions of sound."),
        ("7.3", "The breaking down of a sound\u2014in this case, the sound of a clarinet\u2014into its component sine waves by Fourier analysis. When added together, the component sine waves produce the complex sound wave."),
        ("7.4", "Anatomy of the ear."),
        ("7.5", "Some of the pathways of the auditory system that lead from one ear to the cortex."),
        ("7.6", "General location of the primary auditory cortex and areas of secondary auditory cortex. Most auditory cortex is hidden from view in the lateral fissure."),
        ("7.7", "The hypothesized anterior and posterior auditory pathways."),
        ("7.8", "Cochlear implant: The surgical implantation is shown on the left, and a child with an implant is shown on the right."),
    ]),
    ("The somatosensory system: touch, and the two ascending routes", [
        ("7.9", "Four cutaneous receptors that occur in human skin."),
        ("7.10", "The dorsal-column medial-lemniscus system."),
        ("7.11", "The anterolateral system."),
        ("7.12", "The locations of human primary somatosensory cortex (SI) and one area of secondary somatosensory cortex (SII) with the conventional portrayal of the somatosensory homunculus."),
        ("7.13", "One common induction method for the rubberhand illusion. The participant\u2019s hand is hidden from view by a screen, and a rubber hand is placed next to their hidden hand but in clear sight."),
    ]),
    ("Pain, and the descending system that controls it", [
        ("7.14", "Location of the anterior cingulate cortex in the cingulate gyrus."),
        ("7.15", "The thermal grid illusion. Pain is perceived when one\u2019s hand is placed on a grid of metal rods that alternate between cool and warm."),
        ("7.16", "When experienced as part of a ritual, normally excruciating conditions (e.g., walking on hot coals) often produce little pain."),
        ("7.17", "Basbaum and Fields\u2019s (1978) model of the descending analgesia circuit."),
    ]),
    ("The chemical senses: smell and taste", [
        ("7.18", "The human olfactory system."),
        ("7.19", "Taste receptors, taste buds, and papillae on the surface of the tongue, and a cross-section of a papilla that shows a taste bud and its taste receptors."),
        ("7.20", "The human gustatory system."),
    ]),
    ("Selective attention", [
        ("7.21", "The location of the claustrum."),
        ("7.22", "The change blindness phenomenon. These two illustrations were continually alternated, with a brief (less than 0.1 second) interval between each presentation, and the subjects were asked to report any changes they noticed."),
    ]),
    # ---- Chapter 8 ----
    ("Three principles, and one that follows from practice", [
        ("8.1", "The sensorimotor system as a hierarchy."),
    ]),
    ("The top of the hierarchy: association cortex", [
        ("8.2", "The major cortical input and output pathways of the posterior parietal association cortex. Shown are the lateral surface of the left hemisphere and the medial surface of the right hemisphere."),
        ("8.3", "The major cortical input and output pathways of the dorsolateral prefrontal association cortex. Shown are the lateral surface of the left hemisphere and the medial surface of the right hemisphere."),
    ]),
    ("Secondary motor cortex, and mirror neurons", [
        ("8.4", "Three sorts of secondary motor cortex\u2014supplementary motor area, premotor cortex, and cingulate motor areas\u2014and their output to the primary motor cortex."),
        ("8.5", "Responses of a mirror neuron of a monkey."),
    ]),
    ("Primary motor cortex, and what its map really represents", [
        ("8.6", "The motor homunculus."),
        ("8.7", "An electron micrograph of a motor unit: a motor neuron (pink) and the muscle fibers it innervates."),
    ]),
    ("Spinal circuits, muscles and reflexes", [
        ("8.8", "The biceps and triceps, which are the flexor and extensor muscles, respectively, of the elbow joint."),
        ("8.9", "The muscle-spindle feedback circuit. There are many muscle spindles in each muscle; for clarity, only one much-enlarged muscle spindle is illustrated here."),
        ("8.10", "The function of intrafusal motor neurons."),
        ("8.11", "The elicitation of a stretch reflex. All of the muscle spindles in a muscle are activated during a stretch reflex, but only a single muscle spindle is depicted here."),
        ("8.12", "The automatic maintenance of limb position by the muscle-spindle feedback system."),
        ("8.13", "The reciprocal innervation of antagonistic muscles in the arm. During a withdrawal reflex, elbow flexors are excited, and elbow extensors are inhibited."),
        ("8.14", "The excitatory and inhibitory signals that directly influence the activity of a motor neuron."),
    ]),
    ("Central sensorimotor programs", [
        ("8.15", "The Ebbinghaus illusion. Notice that the central disk on the left appears larger than the one on the right. In fact, both central disks are exactly the same size."),
        ("8.16", "The activity recorded by PET scans during the performance of newly learned and well-practiced sequences of finger movements."),
    ]),
    # ---- Chapter 9 ----
    ("The five phases", [
        ("9.1", "Totipotent, pluripotent, and multipotent cells are all considered to be stem cells. However, their capacity to develop into the different cells of the body differs."),
        ("9.2", "A cross section through the ectoderm, mesoderm, and endoderm in a developing embryo. The neural plate develops from some of the tissue in the endoderm."),
        ("9.3", "How the neural plate becomes the neural tube, across weeks three and four."),
        ("9.4", "Radial glial cells are the stem cells in the developing nervous system. Asymmetric cell division of radial glial cells leads to the production of neurons, glia, and other cells of the nervous system."),
        ("9.5", "Two types of neural migration: radial migration and tangential migration."),
        ("9.6", "Two methods by which cells migrate in the developing neural tube: somal translocation and radial-glia-mediated migration."),
        ("9.7", "Growth cones. The cytoplasmic extensions (the filopodia) of growth cones seem to search for the correct route."),
        ("9.8", "Sperry's eye-rotation experiment, the evidence for chemoaffinity."),
        ("9.9", "The regeneration of the optic nerve of the frog after portions of either the retina or the optic tectum have been destroyed. These phenomena support the topographic gradient hypothesis."),
        ("9.10", "The effect of synapse rearrangement on the selectivity of synaptic transmission. The synaptic contacts of each axon become focused on a smaller number of cells."),
    ]),
    ("Experience: what it does and when", [
        ("9.11", "A few days of early monocular deprivation: axons from the deprived eye branch far less in layer IV."),
    ]),
    ("Neuroplasticity in the adult brain", [
        ("9.12", "Adult neurogenesis. The top panel shows new cells in the dentate gyrus of the hippocampus that are labelled with different colors: the cell bodies of neurons are stained blue, mature glial cells are stained green"),
    ]),
    ("Two developmental disorders", [
        ("9.13", "Two areas of reduced cortical volume and one area of typical cortical volume observed in people with Williams syndrome."),
    ]),
    # ---- Chapter 10 ----
    ("Six causes of brain damage", [
        ("10.1", "A meningioma."),
        ("10.2", "Multiple metastatic brain tumors. The colored areas indicate the location of the larger metastatic brain tumors in this patient."),
        ("10.3", "An MRI of Professor P.\u2019s acoustic neuroma, the very one that he took to his doctor. The arrow indicates the tumor."),
        ("10.4", "An angiogram that illustrates narrowing of one carotid artery (see arrow), a major pathway of blood to the brain."),
        ("10.5", "The cascade by which ischemia-induced glutamate release kills neurons."),
        ("10.6", "A CT scan of a subdural hematoma. Notice that the hematoma has displaced the left lateral ventricle."),
        ("10.7", "The NFL has acknowledged that there is a connection between playing football and chronic traumatic encephalopathy (CTE)."),
    ]),
    ("Five neuropsychological diseases", [
        ("10.8", "Cortical EEG recording of an epileptic seizure. Notice that the trace is characterized by epileptic spikes (sudden, high amplitude EEG signals that accompany epileptic seizures)."),
        ("10.9", "The bursting of an epileptic neuron, recorded by extracellular unit recording."),
        ("10.10", "The bilaterally symmetrical, 3-per-second spike-and-wave EEG discharge associated with absence seizures."),
        ("10.11", "Deep brain stimulation for Parkinson\u2019s disease."),
        ("10.12", "Areas of sclerosis (see arrows) in the white matter of a patient with multiple sclerosis (MS)."),
        ("10.13", "Amyloid plaques (stained blue) in the brain of a deceased patient who had Alzheimer\u2019s disease."),
        ("10.14", "The neuropathology of Alzheimer's disease, microscopic and gross."),
    ]),
    ("How the brain responds to damage: degeneration, regeneration, reorganisation", [
        ("10.15", "Neural and transneuronal degeneration following axotomy."),
        ("10.16", "Three patterns of axonal regeneration that have been observed in mammalian peripheral nerves."),
        ("10.17", "Collateral sprouting after neural degeneration."),
        ("10.18", "Reorganization of the rat motor cortex following transection of the motor neurons that control movements of the vibrissae. The motor cortex was mapped by brain stimulation before transection and then again a few weeks after."),
        ("10.19", "Two proposed mechanisms for the reorganization of neural circuits: (1) strengthening of existing connections through release from inhibition and (2) establishment of new connections by collateral sprouting."),
        ("10.20", "Increased neurogenesis in the dentate gyrus following damage. The left panel shows (1) an electrolytic lesion in the dentate gyrus (damaged neurons are stained turquoise) and (2) the resulting increase in the formation of new cells (stained\u2026"),
        ("10.21", "A rodent in an enriched laboratory environment."),
    ]),
    ("Phantom limbs and the logic of treatment", [
        ("10.22", "Where a touch on Carlos's face produced a sensation in his phantom hand."),
    ]),
    # ---- Chapter 11 ----
    ("H.M., and the five things his case established", [
        ("11.1", "Medial temporal lobectomy. The portions of the medial temporal lobes removed from H.M.\u2019s brain are illustrated in a view of the inferior surface of the brain."),
        ("11.2", "The learning and retention of the mirrordrawing task by H.M. Despite his good retention of the task, H.M. had no conscious recollection of having performed it before."),
        ("11.3", "Two items from the incomplete-pictures test. H.M.\u2019s memory for the 20 items on the test was indicated by his ability to recognize the more fragmented versions of them when he was retested."),
        ("11.5", "Retrograde and anterograde amnesia after a closed-head injury."),
    ]),
    ("Further distinctions, from further patients", [
        ("11.6", "Demonstration of a long gradient of ECS-produced retrograde amnesia. A series of five electroconvulsive shocks produced retrograde amnesia for television shows that played for only one season in the 3 years before the shocks"),
    ]),
    ("Animal models, and the isolation of the hippocampus", [
        ("11.4", "The major components of the hippocampus."),
        ("11.7", "An example of a delayed nonmatching-tosample trial."),
        ("11.8", "The performance deficits of monkeys with large bilateral medial temporal lobe lesions on the delayed nonmatching-to-sample test. There were significant deficits at all but the shortest retention interval."),
        ("11.9", "The three major structures of the medial temporal lobe, illustrated in the monkey brain: the hippocampus, the amygdala, and the medial temporal cortex."),
        ("11.10", "Aspiration lesions of the hippocampus in monkeys and rats. Because of differences in the size and location of the hippocampus (pink) in monkeys and in rats"),
        ("11.11", "The Mumby box and the rat version of the delayed nonmatching-to-sample test."),
        ("11.12", "A comparison of the performance of intact monkeys (ZolaMorgan, Squire, &amp; Mishkin, 1982) and intact rats (Mumby, Pinel, &amp; Wood, 1989) on the delayed nonmatching-to-sample test."),
        ("11.13", "Effects of medial temporal cortex lesions and hippocampus-plus-amygdala lesions in rats. Lesions of the medial temporal cortex, but not of the hippocampus and amygdala combined"),
        ("11.14", "Areas of human medial temporal cortex. These areas are largely hidden from view in the lateral fissure."),
    ]),
    ("Where the memories actually are", [
        ("11.16", "The structures of the brain that have been shown to play a role in memory. Because it would have blocked the view of other structures, the striatum is not included. (See Figure 3.27 on page 93.)"),
    ]),
    ("The synaptic mechanism: long-term potentiation", [
        ("11.15", "If researchers identified a \u201cHarry Potter neuron\u201d in a patient\u2019s brain, what other stimuli might it fire in response to?"),
        ("11.17", "A slice of rat hippocampal tissue that illustrates the three synapses at which LTP is most commonly studied: (1) the dentate granule cell synapse, (2) the CA3 pyramidal cell synapse, and (3) the CA1 pyramidal cell synapse."),
        ("11.18", "Long-term potentiation in the granule cell layer of the rat hippocampal dentate gyrus."),
        ("11.19", "The induction of NMDA-receptor\u2013mediated LTP."),
    ]),
    # ---- Chapter 12 ----
    ("Digestion and the flow of energy", [
        ("12.1", "The gastrointestinal tract and the process of digestion. Not shown in the figure is the gut microbiome, which includes the bacteria and other organisms that live inside our gastrointestinal tract and help break down, store"),
        ("12.2", "Distribution of stored energy in an average person."),
        ("12.3", "The cephalic, absorptive and fasting phases, and what insulin and glucagon do in each."),
    ]),
    ("Set-point theories, and why they fail", [
        ("12.4", "The energy set-point view that is the basis of many people\u2019s thinking about hunger and eating."),
    ]),
    ("What, when and how much we eat", [
        ("12.5", "The sham-eating preparation."),
    ]),
    ("Physiology: hypothalamic centres, then the honest correction", [
        ("12.6", "The ventromedial and lateral hypothalamus in the rat brain."),
        ("12.7", "The system developed by Cannon and Washburn in 1912 for measuring stomach contractions. They found that large stomach contractions were related to pangs of hunger."),
        ("12.8", "Transplantation of an extra stomach and length of intestine in a rat. Koopmans (1981) implanted an extra stomach and length of intestine in each of his experimental subjects."),
        ("12.12", "A control mouse and an ob\u2019ob mouse."),
    ]),
    ("Body-weight regulation: settling point rather than set point", [
        ("12.9", "The diminishing effects on body weight of a low-calorie diet and a high-calorie diet."),
        ("12.10", "The leaky-barrel model: a settling point, not a set point."),
    ]),
    ("Obesity, and why it is so hard to treat", [
        ("12.11", "The five stages of a typical weight-loss program."),
        ("12.13", "Two surgical methods for treating individuals who are extremely overweight: gastric bypass and adjustable gastric band. The gastric band can be tightened by injecting saline into the access port implanted just beneath the skin."),
    ]),
    # ---- Chapter 13 ----
    ("The neuroendocrine system", [
        ("13.1", "The endocrine glands."),
    ]),
    ("The pituitary, and who is actually in charge", [
        ("13.2", "A midline view of the posterior and anterior pituitary and surrounding structures."),
        ("13.3", "The neural connections between the hypothalamus and the pituitary. Notice the neural input to the pituitary all goes to the posterior pituitary; the anterior pituitary has no neural connections."),
        ("13.4", "How the hypothalamus controls the anterior and the posterior pituitary, by two different routes."),
    ]),
    ("Sexual development: one program with switches", [
        ("13.6", "The development of an ovary and a testis from the cortex and the medulla, respectively, of the primordial gonadal structure that is present 6 weeks after conception."),
        ("13.7", "Wolffian and M\u00fcllerian systems: the internal ducts, and the switch that picks one."),
        ("13.8", "The external reproductive organs, both developing from the same bipotential precursor."),
        ("13.9", "The changes that typically occur in males and females during puberty."),
    ]),
    ("Brain differentiation, and the aromatisation surprise", [
        ("13.12", "Effects of neonatal testosterone exposure on the size of the sexually dimorphic nuclei in male and female adult rats, as reported by Gorski (1980)."),
    ]),
    ("Hormones in the adult", [
        ("13.5", "A summary model of the regulation of gonadal hormones."),
        ("13.11", "The sexual behavior of male guinea pigs with low, medium, and high sex drive. Sexual behavior was disrupted by castration and returned to its original level by very large replacement injections of testosterone."),
    ]),
    ("Anomalies, and what each one proves", [
        ("13.10", "David Reimer, the twin whose penis was accidentally destroyed."),
    ]),
    ("Brain mechanisms of sexual behaviour", [
        ("13.13", "The cortex, hypothalamus, amygdala, and ventral striatum: their putative roles in sexual activity. The amygdala and ventral striatum are not visible in this midline view."),
    ]),
    # ---- Chapter 14 ----
    ("Measuring sleep: three signals and five stages", [
        ("14.1", "A participant in a sleep experiment."),
        ("14.2", "The EEG of alert wakefulness, of sleep onset, and of the three stages of sleep."),
        ("14.3", "The course of the EEG stages across a typical night, with REM and the loss of core-muscle tone."),
    ]),
    ("Dreaming: the beliefs that turned out to be wrong", [
        ("14.4", "Two areas of the brain implicated in dreaming and one implicated in visual imagery. Both lesions studies and brain imaging studies have implicated the medial prefrontal cortex and the tempero-parieto junction in dreaming."),
    ]),
    ("Why do we sleep? Two theories and three bodies of evidence", [
        ("14.5", "After gorging themselves on a kill, African lions often sleep almost continuously for 2 or 3 days. And where do they sleep? Anywhere they want!"),
        ("14.6", "The carousel apparatus used to deprive an experimental rat of sleep while a yoked control rat is exposed to the same number and pattern of disk rotations."),
        ("14.7", "The two effects of REM-sleep deprivation."),
        ("14.15", "The mortality rates associated with different amounts of sleep, based on the data of 2,200,425 volunteers over an average duration of 12 years."),
    ]),
    ("Circadian rhythms and the clock", [
        ("14.8", "A free-running sleep-wake cycle of 25.3 hours, with no time cues at all."),
        ("14.9", "Location of the suprachiasmatic nuclei."),
        ("14.10", "The discovery of the retinohypothalamic tracts. Neurons from each retina project to both suprachiasmatic nuclei."),
        ("14.14", "The location of the pineal gland, the source of melatonin."),
    ]),
    ("Brain mechanisms of sleep and arousal", [
        ("14.11", "Two regions of the brain involved in sleep. The anterior hypothalamus and adjacent basal forebrain are thought to promote sleep; the posterior hypothalamus and adjacent midbrain are thought to promote wakefulness."),
        ("14.12", "Four pieces of evidence that the reticular formation is involved in sleep."),
        ("14.13", "A sagittal section of the brain stem of the cat illustrating the areas that control the various physiological indices of REM sleep."),
        ("14.16", "Sleep record of Pinel during a 4-week sleep-reduction program."),
    ]),
    # ---- Chapter 15 ----
    ("Basic pharmacological principles", [
        ("15.1", "Tolerance as a rightward shift of the dose-response curve."),
        ("15.2", "The relation between drug tolerance and withdrawal effects. The same adaptive neurophysiological changes that develop in response to drug exposure and produce drug tolerance manifest themselves as withdrawal effects once the drug is removed\u2026"),
        ("15.3", "Contingent tolerance to the anticonvulsant effect of alcohol. The rats that received alcohol before each convulsive stimulation became tolerant to its anticonvulsant effect"),
        ("15.4", "The situational specificity of tolerance to the hypothermic effects of alcohol in rats."),
    ]),
    ("Five drugs, and their mechanisms", [
        ("15.5", "Global prevalence of addiction to each of six commonly used psychoactive drugs."),
    ]),
    ("Three theories of addiction", [
        ("15.8", "Two behavioral paradigms that are used extensively in the study of the neural mechanisms of addiction: the drug self-administration paradigm and the conditioned place-preference paradigm."),
        ("15.9", "Historic influences that shaped current thinking about the brain mechanisms of addiction."),
        ("15.10", "The three stages in the development of an addiction."),
    ]),
    ("The reward circuit, and what dopamine actually signals", [
        ("15.6", "A rat pressing a lever to obtain rewarding brain stimulation."),
        ("15.7", "The mesotelencephalic dopamine system: nigrostriatal pathway in green, mesocorticolimbic in red."),
    ]),
    ("Relapse, and treatment", [
        ("15.11", "Incubation of cocaine craving in rats that were previously self-administering cocaine. After cocaine withdrawal, there was a time-dependent increase in the number of lever presses the rats made in response to a drug-associated cue."),
    ]),
    # ---- Chapter 16 ----
    ("Establishing cerebral lateralisation", [
        ("16.1", "The cerebral hemispheres and cerebral commissures."),
    ]),
    ("The split brain", [
        ("16.3", "Restricting visual information to one hemisphere in cats. To restrict visual information to one hemisphere, Myers and Sperry (1) cut the corpus callosum, (2) cut the optic chiasm, and (3) blindfolded one eye."),
        ("16.4", "Myers and Sperry (1953): the four groups, and the result that made the split brain a research programme."),
        ("16.5", "The testing procedure for split-brain patients: one visual field, one hemisphere, one hand."),
        ("16.6", "The chimeric figures test, and what each hemisphere reports seeing."),
    ]),
    ("Localising language: the Wernicke-Geschwind model and its problems", [
        ("16.2", "The location of Broca\u2019s area: In the inferior left prefrontal cortex, just anterior to the face area of the left primary motor cortex."),
        ("16.7", "Three language areas of the cerebral cortex that have been the focus of studies on neuroanatomical asymmetry: The frontal operculum, the planum temporale (Wernicke\u2019s area), and Heschl\u2019s gyrus (primary auditory cortex)."),
        ("16.8", "The seven components of the Wernicke-Geschwind model, all in the left hemisphere."),
        ("16.9", "How the Wernicke-Geschwind model works in a person who is responding to a heard question and reading aloud. The hypothetical circuit that allows the person to respond to heard questions is in pink"),
        ("16.10", "The extent of brain damage in one of Broca\u2019s two original patients. Like this patient, most aphasic patients have diffuse brain damage."),
        ("16.11", "The lack of permanent disruption of language-related abilities after surgical excision (indicated in orange) of the classic Wernicke-Geschwind language areas (outlined with dotted lines)."),
        ("16.12", "The responses of the left hemisphere of a 37-year-old right-handed person with epilepsy to electrical stimulation. Numbered cards were placed on the brain during surgery to mark the sites where brain stimulation had been applied."),
        ("16.13", "The wide distribution of left hemisphere sites where cortical stimulation either blocked speech or disrupted it."),
    ]),
    ("Bilingualism and dyslexia", [
        ("16.14", "The areas in which reading-associated increases in activity were observed in the fMRI study of Bavelier and colleagues (1997)."),
    ]),
    # ---- Chapter 17 ----
    ("Darwin, and the three classical theories", [
        ("17.2", "Two woodcuts from Darwin\u2019s 1872 book, The Expression of Emotions in Man and Animals, that he used to illustrate the principle of antithesis."),
        ("17.3", "Four ways of relating the perception of a stimulus, the bodily reaction, and the feeling: the commonsense, James-Lange, Cannon-Bard and modern views."),
    ]),
    ("The search for the emotional brain", [
        ("17.1", "A reconstruction of the brain injury of Phineas Gage. The damage focused on the medial prefrontal lobes."),
        ("17.4", "The location of the structures that Papez proposed controlled emotional expression."),
    ]),
    ("Fear conditioning, and the two roads to the amygdala", [
        ("17.9", "The structures mediating the sympathetic and behavioural responses conditioned to a sound."),
        ("17.10", "Horizontal, sagittal, and coronal functional MRIs show areas of increased activity in the primary motor cortex (M1) and the premotor cortex (PMC) when volunteers watched facial expressions of emotion."),
    ]),
    ("Expression: universality, and the muscles that give it away", [
        ("17.5", "Ekman's six primary facial expressions."),
        ("17.6", "The effects of facial expression on the experience of emotion. Participants reported feeling more happy and less angry when they viewed slides while making a happy face and less happy and more angry when they viewed slides while making an a\u2026"),
        ("17.7", "A fake smile. The orbicularis oculi and the zygomaticus major are two muscles that contract during genuine (Duchenne) smiles."),
        ("17.8", "An expression of pride."),
        ("17.11", "The asymmetry of facial expressions. Notice that the expressions are more obvious on the left side of two well-known faces: those of Mona Lisa and Albert Einstein."),
    ]),
    ("Stress", [
        ("17.12", "The two-system view of the stress response: the anterior-pituitary-adrenal-cortex route and the sympathetic-adrenal-medulla route."),
    ]),
    ("Stress and health", [
        ("17.13", "Phagocytosis: A phagocyte about to ingest and destroy bacteria (red blobs)."),
    ]),
    # ---- Chapter 18 ----
    ("Schizophrenia", [
        ("18.1", "Chlorpromazine as a receptor blocker at dopamine synapses."),
        ("18.2", "Antipsychotic potency plotted against D\u2082 binding: the correlation that made the dopamine theory."),
    ]),
    ("Depression and bipolar disorder", [
        ("18.3", "How fluoxetine blocks serotonin reuptake."),
        ("18.4", "Implantation of bilateral anterior cingulate electrodes and a stimulator for chronic deep brain stimulation for the treatment of depression."),
        ("18.5", "The site in the anterior cingulate gyrus at which chronic brain stimulation to subcortical white matter alleviated symptoms in treatment-resistant depressed patients."),
    ]),
    ("Tourette syndrome", [
        ("18.6", "No rebound effect above baseline was observed following periods of tic suppression by children with Tourette\u2019s disorder."),
    ]),
    ("Clinical trials: how to read the evidence", [
        ("18.7", "The probabilities that a drug that qualifies for testing in humans will reach each phase of testing and ultimately gain approval. Only 22 percent of the drugs that initially qualify for testing eventually gain approval."),
    ]),
]

BLOCK = ('<figure class="bfig" id="{kind}-{sid}">'
         '<a href="../figs/pinel/{pfx}_{sid}.jpg" target="_blank" rel="noopener">'
         '<img src="../figs/pinel/{pfx}_{sid}.jpg" loading="lazy" alt="Pinel {word} {num}: {alt}"></a>'
         '<figcaption><b>{cap}</b> <span>{credit} &middot; {abbr}&nbsp;{num}</span></figcaption>'
         '</figure>')

# The numbered TABLES, cropped in the same pass (see /tmp/sweep_pinel.py). They
# were never in the `Figure N.M` inventory, so the 309-figure pass could not see
# them; they are keyed "T<n>.<m>" here and share the whole placement pipeline.
TABLE_PLAN = [
    ("The founding text: Hebb, 1949", [
        ("T1.1", "Nobel prizes specifically related to the nervous system or behavior."),
    ]),
    ("The six divisions of biopsychology", [
        ("T1.2", "The six major divisions of biopsychology with examples of how they have approached the study of memory."),
    ]),
    ("Measuring sleep: three signals and five stages", [
        ("T14.1", "Summary of the various sleep-stage terms."),
    ]),
    ("Why do we sleep? Two theories and three bodies of evidence", [
        ("T14.2", "Average number of hours slept per day by various mammalian species."),
    ]),
    ("Drugs, and the disorders", [
        ("T14.3", "Summary of the drugs that affect sleep."),
    ]),
    ("What the hemispheres actually differ in", [
        ("T16.1", "Abilities that display some degree of cerebral lateralization."),
    ]),
    ("Darwin, and the three classical theories", [
        ("T17.1", "Biopsychological investigation of emotion: six early landmarks."),
    ]),
    ("The search for the emotional brain", [
        ("T17.2", "Categories of aggressive and defensive behaviors in rats."),
    ]),
    ("Clinical trials: how to read the evidence", [
        ("T18.1", "Phases of drug development."),
    ]),
]


STOP = set("""a an the of and or to in on at by for with from as is are was were be been being it its
this that these those which who whom whose what when where how why not no than then there here into
over under about between during after before both each other more most some such only own same so
can will just also very much many one two three do does did done have has had but if while figure
shows show shown see them they their his her he she you your we our""".split())


def words(s):
    s = re.sub(r'<[^>]+>', ' ', s).lower()
    return [w for w in re.findall(r'[a-z][a-z\-]{2,}', s) if w not in STOP]


def anchors(section):
    """Top-level insertion points in a section: the end of each paragraph,
    list, table or callout. Anything nested inside a <div>/<details> is
    skipped, so a figure can never land inside a callout box."""
    out, depth, prev = [], 0, 0
    for m in re.finditer(r'<(/?)(div|details|p|ul|ol|table|h4)\b[^>]*?>', section):
        close, tag = m.group(1) == '/', m.group(2)
        if tag in ('div', 'details'):
            depth += -1 if close else 1
            if close and depth == 0:
                out.append((section[prev:m.end()], m.end()))
                prev = m.end()
        elif close and depth == 0 and tag in ('p', 'ul', 'ol', 'table'):
            out.append((section[prev:m.end()], m.end()))
            prev = m.end()
    return out


def choose(figs, cands):
    """Pick an insertion point per figure: the block whose prose is closest to
    the caption, subject to the figures staying in the book's order and
    spreading out rather than piling onto one paragraph. Small enough to solve
    exactly (<=12 figures, <=40 blocks)."""
    if not cands:
        return [None] * len(figs)
    texts = [set(words(t)) for t, _ in cands]
    sc = []
    for k, (_, cap) in enumerate(figs):
        cw = set(words(cap))
        row = []
        for j, tw in enumerate(texts):
            hit = len(cw & tw) / (len(cw) ** 0.5 + 1)
            # figures run in the book's order, so figure k belongs roughly
            # k/len(figs) of the way down the section
            drift = abs(j / max(1, len(cands) - 1) - k / max(1, len(figs) - 1))
            row.append(hit * 3.0 - drift * 1.6)
        sc.append(row)
    NEG = -1e9
    best = [[NEG] * len(cands) for _ in figs]
    back = [[0] * len(cands) for _ in figs]
    for j in range(len(cands)):
        best[0][j] = sc[0][j]
    for k in range(1, len(figs)):
        for j in range(len(cands)):
            for i in range(j + 1):
                v = best[k - 1][i] + sc[k][j] - (0.9 if i == j else 0.0)
                if v > best[k][j]:
                    best[k][j], back[k][j] = v, i
    j = max(range(len(cands)), key=lambda x: best[-1][x])
    picks = [j]
    for k in range(len(figs) - 1, 0, -1):
        j = back[k][j]
        picks.append(j)
    return list(reversed(picks))


def merged_plan():
    """PLAN with the tables folded in under the same heading, so a section that
    has both lays them out in one pass instead of two that fight each other."""
    tbl = {}
    for heading, items in TABLE_PLAN:
        tbl.setdefault(heading, []).extend(items)
    out, seen = [], set()
    for heading, figs in PLAN:
        seen.add(heading)
        out.append((heading, list(figs) + tbl.get(heading, [])))
    for heading, items in TABLE_PLAN:
        if heading not in seen:
            seen.add(heading)
            out.append((heading, list(items)))
    return out


def main():
    with open(BOOK, encoding="utf-8") as f:
        doc = f.read()

    # idempotent: clear any previous pass
    doc = re.sub(r'<div class="bfigs">.*?</div>\n?', '', doc, flags=re.S)

    placed, missing_file, missing_anchor = 0, [], []
    for heading, figs in merged_plan():
        usable = []
        for num, cap in figs:
            is_tbl = num.startswith("T")
            n = num[1:] if is_tbl else num
            sid = n.replace(".", "_")
            pfx = "t" if is_tbl else "f"
            if not os.path.isfile(os.path.join(FIGDIR, f"{pfx}_{sid}.jpg")):
                missing_file.append(num)
                continue
            alt = re.sub(r'<[^>]+>', '', cap).rstrip('.')
            usable.append((num, cap, BLOCK.format(
                sid=sid, num=n, cap=cap, alt=alt, credit=CREDIT, pfx=pfx,
                kind="tbl" if is_tbl else "fig",
                word="Table" if is_tbl else "Figure",
                abbr="Table" if is_tbl else "Fig")))
        if not usable:
            continue

        m = re.search(r'<h3[^>]*>' + re.escape(heading) + r'</h3>', doc)
        if not m:
            missing_anchor.append(heading)
            continue
        nxt = re.search(r'<h[23][^>]*>', doc[m.end():])
        s0, s1 = m.end(), m.end() + (nxt.start() if nxt else len(doc) - m.end())
        section = doc[s0:s1]

        cands = anchors(section)
        picks = choose([(n, c) for n, c, _ in usable], cands)

        groups = {}
        for (num, cap, blk), j in zip(usable, picks):
            groups.setdefault(-1 if j is None else j, []).append(blk)

        out, cut = [], 0
        for j in sorted(groups):
            if j < 0:                       # no paragraph to hang it on
                continue
            end = cands[j][1]
            out.append(section[cut:end])
            out.append('\n<div class="bfigs">' + ''.join(groups[j]) + '</div>\n')
            cut = end
        out.append(section[cut:])
        lead = ''.join('<div class="bfigs">' + ''.join(groups[-1]) + '</div>\n'
                       for _ in ([1] if -1 in groups else []))
        doc = doc[:s0] + '\n' + lead + ''.join(out) + doc[s1:]
        placed += len(usable)

    with open(BOOK, "w", encoding="utf-8") as f:
        f.write(doc)

    print(f"placed {placed} figures+tables across {len(merged_plan())} anchors")
    if missing_file:
        print("MISSING IMAGE FILES:", missing_file)
    if missing_anchor:
        print("ANCHOR NOT FOUND:", missing_anchor)
    return 1 if (missing_file or missing_anchor) else 0


if __name__ == "__main__":
    sys.exit(main())
