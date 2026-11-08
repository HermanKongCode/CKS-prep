/* CKS Prep - per-option rationales, Supply Chain Security. Shown only after the learner submits an answer. */
window.CKS_QUIZ_WHY_5 = {
  "q-sc-1": [
    "distroless static-nonroot carries just the binary plus CA files, no shell or package manager, and runs under a non-root UID.",
    "scratch adds nothing itself, so the image is exactly the static binary and the CA bundle you copy into it, the smallest footprint.",
    "Only the final stage is exported to the registry, so compilers, sources and build dependencies stay behind in discarded layers.",
    "pip installing build dependencies leaves pip, compilers and headers in the runtime image, enlarging it and the exploit surface.",
    "A full distribution base adds a shell, a package manager and hundreds of unused packages, and latest is mutable, so bytes change."
  ],
  "q-sc-2": [
    "TLS validation needs a trust anchor, so copying /etc/ssl/certs from the build stage gives scratch a CA bundle with no package manager.",
    "allowPrivilegeEscalation only blocks setuid and capability gains, so it has no bearing on certificate trust and the TLS error stays.",
    "An HTTPS probe performs the same certificate validation against the same missing trust store, so the container fails readiness.",
    "scratch has no apk, no shell and no package database, so a RUN layer cannot execute there; certificates must be copied, not installed."
  ],
  "q-sc-3": [
    "docker history --no-trunc lists the instruction behind each remaining layer, and an SBOM scan shows packages actually in the final image.",
    "The entrypoint is image metadata about the start command; it says nothing about which binaries were copied into the layers.",
    "kubectl describe shows one Pod runtime view, args, mounts and status, not image contents, so a compiler inside the image never appears.",
    "The builder log proves what was compiled in stage 1, but it cannot show what the final stage copied into its own layers."
  ],
  "q-sc-4": [
    "Names, versions and package identifiers such as purls are the core of SPDX and CycloneDX output, and CVE lookups match against them.",
    "Digests for each package plus the image digest tie the inventory to the exact bytes that were built, so a claim is verifiable.",
    "SPDX relationships and CycloneDX dependencies record which package belongs to which image, which is what makes it an inventory.",
    "A seccomp profile describes runtime syscall confinement, not composition, so it belongs beside the Pod spec, not in the artifact inventory."
  ],
  "q-sc-5": [
    "A keyless signature is bound to an OIDC identity, so cosign requires the issuer plus a certificate identity before trusting the signer.",
    "The --key flag expects a public key from a keypair the signer controls, which keyless certificate signatures do not have.",
    "Annotations are optional metadata matched after a signature verifies, so alone they give cosign neither a key nor a trusted identity.",
    "Recent cosign refuses keyless verification without identity flags, since any OIDC identity would otherwise be accepted."
  ],
  "q-sc-6": [
    "A tag can be repushed to other bytes, so its signature follows a moving alias, while a sha256 digest is content-addressed and fixed.",
    "Admission image verification resolves the reference to a digest before checking signatures, so a tag signature guarantees nothing.",
    "Verifying a tag at admission accepts whatever the tag currently points at, so the tag signature adds no immutability guarantee.",
    "Registry-level signatures attest a push to that registry, not the content of the image, so they cannot stand in for a content signature."
  ],
  "q-sc-7": [
    "verifyImages is Kyverno image-aware admission rule, and in Enforce mode a Pod whose image fails cosign verification is rejected.",
    "ImagePolicyWebhook delegates each image reference to an external decision endpoint, which can deny an unsigned image at admission.",
    "Pod Security Standards validate Pod fields such as capabilities and seccomp, never the provenance or signature of an image reference.",
    "NodeRestriction limits what a kubelet may write about its own Node and its scheduled Pods; it is not in the image admission path."
  ],
  "q-sc-8": [
    "A sha256 reference pins the exact bytes, and for a digest reference the pull policy is already IfNotPresent, so the copy is reused.",
    "latest is reassigned on every push and Always re-resolves it, so a new Pod can run different bytes than the image that was reviewed.",
    "A mutable tag plus Always still lets a redeploy under the same tag change the running image, so the deployment is not reproducible.",
    "imagePullSecrets only supplies registry credentials; with a tag and Always the image still depends on where the tag points now."
  ],
  "q-sc-9": [
    "Trivy maps CVEs found in image layers, and --exit-code 1 makes matching findings return a failing exit status for the CI job.",
    "Kubesec scores a workload manifest for risk such as hostPath or privileged settings; it takes YAML, not an image, and reports no CVEs.",
    "KubeLinter analyses manifest files for issues such as unpinned images or missing probes; an image archive is not something it can lint.",
    "Conftest runs your own Rego rules over structured config, so it can judge an image reference but has no vulnerability database."
  ],
  "q-sc-10": [
    "KubeLinter parses Kubernetes manifests and runs built-in checks against them, optionally calling scanners on the referenced images.",
    "Kubesec weighs manifest grants such as privileged, hostPath and capabilities and returns a risk score for that workload definition.",
    "Conftest parses manifests as structured data and evaluates your Rego policies over them, enforcing your own rules in CI.",
    "kube-bench checks a live cluster against CIS benchmarks by reading control-plane files and running probes, not your undeployed YAML.",
    "syft catalogues image layers into an SBOM; vulnerability matching is done by Grype or Trivy, and neither tool inspects running Pods."
  ],
  "q-sc-11": [
    "Pods inherit imagePullSecrets from the ServiceAccount they run with, so patching the default ServiceAccount covers the whole namespace.",
    "This works for each workload but requires editing and maintaining every manifest in the namespace, which is the burden to avoid.",
    "The kubelet pulls images before the container starts using only imagePullSecrets, so a registry password in an env var is never consulted.",
    "Allowing anonymous pulls scoped to a source address removes registry authentication and lets any workload fetch arbitrary images."
  ],
  "q-sc-12": [
    "initContainers, ephemeral debug containers and injected sidecars each carry their own image field, so checking spec.containers is bypassed.",
    "A ConfigMap may name an image string, but the kubelet never pulls from it, so it is not a route by which an image reaches a node.",
    "An Ingress routes HTTP traffic to a Service and never causes an image pull, so it is not part of the container provenance path.",
    "imagePullPolicy decides when the kubelet re-fetches an already-present image; it does not constrain which registry a reference may name."
  ],
  "q-sc-13": [
    "One build per commit plus a digest reference ties deployed bytes to that commit, and its SBOM and signature provide the evidence.",
    "latest moves whenever it is repushed, so a release calendar cannot fix which bytes the cluster runs; nothing is pinned in the manifest.",
    "A stable runner makes the build environment repeatable, but it does not pin the identity of the artifact the deployment actually runs.",
    "GPG on the manifest authenticates the YAML text, not the image the manifest references, so the running container bytes stay unattested."
  ],
  "q-sc-14": [
    "Provenance records who built the artifact, from which source revision and in which pipeline, making the build attributable to an identity.",
    "Attestations live in linked artifact references, so a plain copy of the image does not move them; cosign copy or equivalent is needed.",
    "Admission policy can look up the attestation bound to an image digest and reject a Pod whose image lacks the attestation you require.",
    "Attestations are verified against the build identity through Sigstore Fulcio and Rekor, so the cluster CA is not their trust anchor."
  ]
};
