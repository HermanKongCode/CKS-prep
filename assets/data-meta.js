/*
 * CKS Prep - metadata: exam facts, official blueprint, study resources.
 * Blueprint text transcribed from the Linux Foundation CKS certification page
 * (Domains & Competencies section). Weights and versions change - re-check the
 * official page before your exam. Last transcription: 2026-11-08.
 */
window.CKS_META = {
  cert: "Certified Kubernetes Security Specialist (CKS)",
  issuer: "Linux Foundation + CNCF",
  version: "Exam based on Kubernetes v1.37 (LF aligns the environment to the newest minor 4-8 weeks after release)",
  blueprintCaptured: "2026-11-08",
  durationMinutes: 120,
  passMark: 65,
  passMarkNote:
    "65% is the passing score published for CKS by the Linux Foundation. Verify in the Candidate Handbook for your reservation - scores are not shown by killer.sh as percentages on purpose.",
  prerequisites:
    "You must hold a current CKA (Certified Kubernetes Administrator). CKA is a hard prerequisite for CKS.",
  delivery:
    "Online, proctored, performance-based (hands-on tasks in a live cluster from a command line). No multiple choice in the real exam.",
  environment:
    "Exam runs in a Remote Desktop with a Terminal Emulator application and Firefox for the Kubernetes docs. Copy/paste to and from the exam machine is restricted; nested SSH is not supported - exit nested shells to return to your main terminal.",
  attempts:
    "The standard CKS package includes 2 exam attempts and 2 killer.sh simulator attempts (17 scenarios each, 36 hours of environment access per attempt). 12 months to schedule.",
  results: "Pass/fail results are typically available within 24 hours.",
  price: "Exam only bundle listed at USD 445 (bundles with LFS260 / THRIVE-ONE subscription cost more; regional prices vary).",
  disclaimer:
    "Facts above were read from training.linuxfoundation.org and killer.sh/faq. Policies, price, weights and the Kubernetes version change - always confirm on the official pages before you book.",
  sources: [
    { label: "CKS certification page (Domains & Competencies, exam details)", url: "https://training.linuxfoundation.org/certification/certified-kubernetes-security-specialist/" },
    { label: "CKS program changes (what changed in the blueprint)", url: "https://training.linuxfoundation.org/cks-program-changes/" },
    { label: "Killer Shell simulator FAQ (environment, 36h access, restart session)", url: "https://killer.sh/faq" },
    { label: "Kubernetes docs (allowed in the exam)", url: "https://kubernetes.io/docs/home/" },
    { label: "CIS Kubernetes Benchmark (hardening controls)", url: "https://www.cisecurity.org/benchmark/kubernetes" },
    { label: "Pod Security Standards", url: "https://kubernetes.io/docs/concepts/security/pod-security-standards/" },
    { label: "Sigstore / cosign (sign + verify images)", url: "https://docs.sigstore.dev/" },
    { label: "Falco rules documentation", url: "https://falco.org/docs/rules/" }
  ]
};

window.CKS_BLUEPRINT = [
  {
    id: "cluster-setup",
    name: "Cluster Setup",
    weight: 15,
    color: "#4ec9b0",
    competencies: [
      "Use Network security policies to restrict cluster level access",
      "Use CIS benchmark to review the security configuration of Kubernetes components (etcd, kubelet, kubedns, kubeapi)",
      "Properly set up Ingress with TLS",
      "Protect node metadata and endpoints",
      "Verify platform binaries before deploying"
    ]
  },
  {
    id: "cluster-hardening",
    name: "Cluster Hardening",
    weight: 15,
    color: "#c586c0",
    competencies: [
      "Use Role Based Access Controls to minimize exposure",
      "Exercise caution in using service accounts: disable defaults, minimize permissions on newly created ones",
      "Restrict access to the Kubernetes API",
      "Upgrade Kubernetes to avoid vulnerabilities"
    ]
  },
  {
    id: "system-hardening",
    name: "System Hardening",
    weight: 10,
    color: "#dcdcaa",
    competencies: [
      "Minimize host OS footprint (reduce attack surface)",
      "Using least-privilege identity and access management",
      "Minimize external access to the network",
      "Appropriately use kernel hardening tools such as AppArmor, seccomp"
    ]
  },
  {
    id: "microservices",
    name: "Minimize Microservice Vulnerabilities",
    weight: 20,
    color: "#f48771",
    competencies: [
      "Use appropriate pod security standards",
      "Manage Kubernetes secrets",
      "Understand and implement isolation techniques (multi-tenancy, sandboxed containers)",
      "Implement Pod-to-Pod encryption (Cilium, Istio)"
    ]
  },
  {
    id: "supply-chain",
    name: "Supply Chain Security",
    weight: 20,
    color: "#61afef",
    competencies: [
      "Minimize base image footprint",
      "Understand your supply chain (SBOM, CI/CD, artifact repositories)",
      "Secure your supply chain (permitted registries, sign and validate artifacts)",
      "Perform static analysis of user workloads and container images (Kubesec, KubeLinter)"
    ]
  },
  {
    id: "runtime-security",
    name: "Monitoring, Logging and Runtime Security",
    weight: 20,
    color: "#e5c07b",
    competencies: [
      "Perform behavioral analytics to detect malicious activities",
      "Detect threats within physical infrastructure, apps, networks, data, users and workloads",
      "Investigate and identify phases of attack and bad actors within the environment",
      "Ensure immutability of containers at runtime",
      "Use Kubernetes audit logs to monitor access"
    ]
  }
];

window.CKS_EXAM_TIPS = [
  {
    title: "Time budget: 17 scenarios in 120 minutes",
    body:
      "Roughly 6-7 minutes per task. Flag and skip: solve everything you know cold first, then come back. In a performance-based exam an unfinished task scores zero, so a quick partial win on many tasks beats a perfect win on two."
  },
  {
    title: "Docs are your cheat sheet",
    body:
      "You get Kubernetes docs in the exam browser (in the Remote Desktop browser, not your local one). Practise finding a page in under 60 seconds: audit logging, NetworkPolicy examples, RBAC reference, Pod Security Standards, kubeadm upgrade, admission controllers. Do not memorise YAML you can copy from docs."
  },
  {
    title: "Memorise the things docs cannot give you",
    body:
      "Where the flags live: /etc/kubernetes/manifests (static pods for kube-apiserver, etcd, scheduler, controller-manager), /var/lib/kubelet/config.yaml, /etc/kubernetes/pki, /etc/kubernetes/admin.conf, etcd cert paths, /etc/kubernetes/policy for audit policies. Half the task time is spent locating the file you must edit."
  },
  {
    title: "One terminal, one browser tab pattern",
    body:
      "alias k=kubectl (already set in the exam shell), k edit deploy x -o yaml, k explain pod.spec.securityContext, k get --raw, k auth can-i. Keep your editor in the terminal (vi or nano) - do not try to edit files from the browser."
  },
  {
    title: "Verify your own work before moving on",
    body:
      "Every task is graded by a script. After applying a change, run the check yourself: k auth can-i for RBAC, k run test --image=... to prove a NetworkPolicy blocks traffic, k apply --dry-run=server for policy admission, kube-bench rerun for CIS fixes, falco -o to see an alert fire."
  },
  {
    title: "Pod is privileged - read the task carefully",
    body:
      "Tasks often say 'in namespace X, make Pod Y compliant' rather than 'create a new Pod'. Editing an existing object is faster: k edit or k patch. Also read whether you must keep the app running (a deny-all policy that breaks DNS is a classic 0-point answer)."
  },
  {
    title: "Killer.sh is the single best practice tool",
    body:
      "Two simulator attempts (17+17 scenarios, 36 hours each) come with your registration. Save your first attempt for the last 1-2 weeks before the real exam so weak areas get a second pass. Killercoda free labs are the cheap warm-up."
  },
  {
    title: "Do not overreach on tools you cannot install",
    body:
      "If a task says 'install Falco', use the exact upstream instructions (falcoctl driver, Helm values, DaemonSet). If a task says 'ensure Pods are signed', use the built-in ImagePolicyWebhook / Kyverno / PodImageVerification rather than a custom webhook you have to write from scratch."
  }
];

window.CKS_RESOURCES = [
  { label: "Kubernetes Security Documentation (the exam's primary reference)", url: "https://kubernetes.io/docs/concepts/security/" },
  { label: "kubeadm - setup, HA, upgrade", url: "https://kubernetes.io/docs/setup/production-environment/tools/kubeadm/" },
  { label: "Audit logging + policy reference", url: "https://kubernetes.io/docs/tasks/debug/debug-cluster/audit/" },
  { label: "Encrypting Secret Data at Rest", url: "https://kubernetes.io/docs/tasks/administer-cluster/encrypt-data/" },
  { label: "Pod Security Standards", url: "https://kubernetes.io/docs/concepts/security/pod-security-standards/" },
  { label: "PodSecurity admission (built-in)", url: "https://kubernetes.io/docs/concepts/security/pod-security-admission/" },
  { label: "Network Policies write-up + recipes", url: "https://kubernetes.io/docs/concepts/services-networking/network-policies/" },
  { label: "RuntimeClass (gVisor / Kata)", url: "https://kubernetes.io/docs/concepts/containers/runtime-class/" },
  { label: "AppArmor + seccomp in Kubernetes", url: "https://kubernetes.io/docs/tutorials/security/apparmor/" },
  { label: "ImagePolicyWebhook admission plugin", url: "https://kubernetes.io/docs/reference/instrumentation/cluster-debugging-recipes/" },
  { label: "kube-bench (CIS Kubernetes Benchmark)", url: "https://github.com/aquasecurity/kube-bench" },
  { label: "Falco - behavioral analytics", url: "https://falco.org/docs/" },
  { label: "Kyverno policies (PSA replacement, image verification)", url: "https://kyverno.io/docs/" },
  { label: "cosign / Sigstore (sign + verify + SBOM)", url: "https://github.com/sigstore/cosign" },
  { label: "Trivy (image, filesystem and cluster scanning)", url: "https://trivy.dev/latest/" },
  { label: "Kubesec / KubeLinter (static analysis)", url: "https://github.com/controlplaneio/kubesec" },
  { label: "Killercoda free Kubernetes security playgrounds", url: "https://killercoda.com/" },
  { label: "Killer.sh official CKS simulator FAQ", url: "https://killer.sh/faq" },
  { label: "Linux Foundation Candidate Handbook", url: "https://training.linuxfoundation.org/candidate-handbook/" }
];
