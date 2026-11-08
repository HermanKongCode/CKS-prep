/*
 * CKS LABS - exam-style walkthroughs.
 *
 * Nothing on this site creates or simulates a cluster. Each lab is a scenario you
 * rehearse on a cluster you control (kind, minikube, a kubeadm VM, a cloud
 * sandbox) or read end to end as a worked example. The commands, flags and file
 * paths are the study content.
 *
 * A plain file name (kind-config.yaml, manifests/20-netpol-deny.yaml, a
 * Dockerfile) means a file you write yourself in a scratch folder - the YAML you
 * need is in the Learn tab, in the YAML blocks of the linked topics. An absolute
 * path (/etc/kubernetes/..., /var/lib/kubelet/...) is a path on the node.
 *
 * Where verify commands assume a kind cluster, use one named "cks" with
 * cks-control-plane, cks-worker, cks-worker2 and cks-etcd. Where a lab says
 * "docker exec into a node container", a kubeadm VM uses ssh - the paths and
 * commands inside are the same as on the exam node.
 *
 * Shape: { id, domain, title, difficulty, minutes, timed, scenario, needs[], files[],
 *          tasks[], verify[], solution[{cmd,why}], pitfalls[], related[topic ids] }
 */

window.CKS_LABS = [

/* ------------------------------------------------------------------ */
{
  id: "lab-00-cluster", domain: "cluster-setup",
  title: "Build the practice cluster (audit logging + encryption at rest from day one)",
  difficulty: "setup", minutes: 20, timed: 0,
  scenario: "The exam cluster is a kubeadm cluster: static pods on the control plane, an etcd member you can query, audit logging live, Secrets encrypted in etcd. Rehearse building that shape on any cluster you control - or read this lab as the map of where everything else on this site lives.",
  needs: ["A cluster you control (kind on Docker Desktop with WSL2, minikube, or a kubeadm VM)", "kubectl on PATH"],
  files: ["kind-config.yaml", "audit-policy.yaml"],
  tasks: [
    "Write your own cluster config (kind-config.yaml or a kubeadm InitConfiguration) with the audit and encryption flags wired in from the start.",
    "Explain which kubeadm objects the patches land on, and why the audit files are mounted twice: once into the node, once into the API server container.",
    "Confirm the API server flags really arrived, then confirm audit events are being written.",
    "Confirm encryption at rest by reading a Secret's stored bytes straight from etcd."
  ],
  verify: [
    "kubectl get nodes -o wide && kubectl get pods -n kube-system",
    "kubectl -n kube-system get pod kube-apiserver-cks-control-plane -o jsonpath='{.spec.containers[0].command}'",
    "kubectl get secrets -A > $null; docker exec cks-control-plane sh -c 'tail -2 /var/log/kubernetes/audit.log | cut -c1-200'",
    "docker exec cks-etcd etcdctl get /registry/secrets --prefix --keys-only --cacert /etc/kubernetes/pki/etcd/ca.crt --cert /etc/kubernetes/pki/etcd/server.crt --key /etc/kubernetes/pki/etcd/server.key | head"
  ],
  solution: [
    { cmd: "kind create cluster --name cks --config kind-config.yaml --wait 180s",
      why: "kind-config.yaml carries the kubeadm patches (audit and encryption extraArgs plus extraVolumes) and the extraMounts that put the policy files inside the control-plane container. That container holds exactly the kubeadm layout you will see on an exam node." },
    { cmd: "kubectl -n kube-system get pod kube-apiserver-cks-control-plane -o jsonpath='{.spec.containers[0].command}'",
      why: "The command array is the ground truth for which flags are enabled. If your kind version ignored the ClusterConfiguration patch the flags are missing, and the fallback is to edit /etc/kubernetes/manifests/kube-apiserver.yaml inside the node container (docker exec, save, and the kubelet re-creates the pod within seconds)." },
    { cmd: "kubectl create secret generic probe -n prod --from-literal=ck=1; docker exec cks-etcd etcdctl get /registry/secrets/probe/probe --print-value-only --cacert /etc/kubernetes/pki/etcd/ca.crt --cert /etc/kubernetes/pki/etcd/server.crt --key /etc/kubernetes/pki/etcd/server.key | cut -c1-120",
      why: "Look for the k8s:enc:aescbc:v1:key1 marker. A value with no provider marker means the aescbc provider is not in use: check provider order in the config file and whether the API server actually restarted after the change." },
    { cmd: "kubectl apply -f manifests/00-cluster-base.yaml",
      why: "Namespaces with Pod Security labels, the sample workloads, and the default-deny policy that the later labs depend on." }
  ],
  pitfalls: [
    "kind applies its patches only at cluster creation. Editing kind-config.yaml for an existing cluster does nothing - tear down and recreate.",
    "kind's etcd is a separate container named cks-etcd; on a stacked kubeadm node the same etcdctl command runs inside the etcd static pod.",
    "kindest/node ships no AppArmor tooling, no Falco driver and no gVisor. Labs that need host-level kernel features say so and give the VM equivalent."
  ],
  related: ["cs-cis", "ch-api-access", "ms-secrets", "rt-audit"]
},

/* ------------------------------------------------------------------ */
{
  id: "lab-01-netpol", domain: "cluster-setup",
  title: "Default-deny, then rebuild only what the app needs",
  difficulty: "easy", minutes: 25, timed: 12,
  scenario: "Namespace prod holds payments-api. It must reach the payments backend on 8080, resolve DNS, and reach nothing else - including the cloud metadata endpoint.",
  needs: ["kubectl"],
  files: ["manifests/00-cluster-base.yaml", "manifests/20-netpol-deny.yaml", "manifests/50-containment-netpol.yaml"],
  tasks: [
    "Apply default-deny and prove you broke the app: a probe Pod in prod fails to reach payments-api and fails DNS.",
    "Write the egress allow-list (DNS to kube-dns, backend on 8080) and the ingress rule that admits only web/frontend.",
    "Block 169.254.169.254 with an ipBlock except while keeping the internal 10.0.0.0/16 range usable.",
    "Explain how you would confirm that this cluster's CNI actually enforces NetworkPolicy."
  ],
  verify: [
    "kubectl run probe -n prod --rm -it --image=busybox:1.36 --restart=Never -- sh -c 'nslookup kubernetes.default.svc.cluster.local; wget -qO- --timeout=3 http://payments-api.prod.svc.cluster.local:8080/healthz || echo BLOCKED'",
    "kubectl get netpol -A && kubectl describe netpol prod-egress-allowlist -n prod",
    "kubectl run probe -n prod --rm -it --image=busybox:1.36 --restart=Never -- sh -c 'wget -qO- --timeout=3 http://169.254.169.254/ || echo BLOCKED'"
  ],
  solution: [
    { cmd: "kubectl apply -f manifests/20-netpol-deny.yaml; kubectl run probe -n prod --rm -it --image=busybox:1.36 --restart=Never -- sh",
      why: "Test from inside the affected namespace instead of reasoning about the YAML. A nslookup timeout is the proof that isolating egress also isolates DNS - the mistake that turns a NetworkPolicy task into an outage." },
    { cmd: "kubectl apply -f manifests/50-containment-netpol.yaml",
      why: "One file, three policies: default-deny ingress, ingress from web/frontend only, and an egress allow-list carrying DNS, the backend and the internal range with 169.254.169.254 subtracted in except." },
    { cmd: "kubectl get pods -n prod -o wide; kubectl logs deployment/payments-api -n prod --tail=20",
      why: "After every allow-list change read the workload's own logs. A service that silently stops resolving names is the usual blast radius." },
    { cmd: "kubectl get pods -n kube-system | grep -iE 'calico|cilium|kube-router|flannel|weave'",
      why: "Enforcement is a property of the CNI, not of Kubernetes. Flannel and several kube-router or Calico configurations accept NetworkPolicy objects and ignore them, so kubectl get netpol succeeding proves nothing." }
  ],
  pitfalls: [
    "A namespaceSelector with no matchLabels selects every namespace - the most common wrong answer.",
    "NetworkPolicy has no deny rules: isolation plus allow rules is the only model available.",
    "A Pod selected by any policy for a direction loses every flow in that direction that no rule permits, including the load-balancer path."
  ],
  related: ["cs-netpol", "cs-node-metadata", "ms-tenancy"]
},

/* ------------------------------------------------------------------ */
{
  id: "lab-02-cis", domain: "cluster-setup",
  title: "Run the CIS benchmark, then fix two real findings",
  difficulty: "medium", minutes: 25, timed: 15,
  scenario: "An auditor hands you kube-bench output. Pick two failing control-plane checks, fix them on the node, and show the check now passes - without breaking the API server.",
  needs: ["kubectl", "docker (to reach the control-plane container)"],
  files: ["manifests/40-kube-bench.yaml"],
  tasks: [
    "Run kube-bench and read the failing items together with their info text.",
    "Choose two findings that map to static-pod flags and apply them in /etc/kubernetes/manifests/kube-apiserver.yaml.",
    "Watch the kubelet re-create the static pod, re-run the benchmark and diff FAIL to PASS.",
    "Write down which findings you deliberately left alone and why."
  ],
  verify: [
    "kubectl apply -f manifests/40-kube-bench.yaml; kubectl wait --for=condition=complete job/kube-bench --timeout=240s",
    "kubectl logs job/kube-bench | jq -c '.Results[] | {node_type, fails: [.tests[] | select(.status==\"fail\") | {n: .test_number, d: .test_desc}]}'",
    "kubectl -n kube-system get pod kube-apiserver-cks-control-plane -o jsonpath='{.status.containerStatuses[0].restartCount}'",
    "kubectl get --raw /readyz && kubectl auth can-i get secrets --as=system:serviceaccount:default:default"
  ],
  solution: [
    { cmd: "docker exec cks-control-plane sh -c 'grep -n -A 30 \"command:\" /etc/kubernetes/manifests/kube-apiserver.yaml'",
      why: "Control-plane hardening means editing a manifest on the node. In the exam you get a terminal on the node: docker exec here, ssh there. Read the flags already present before adding your own." },
    { cmd: "docker exec cks-control-plane sh -c 'sed -i \"/    - kube-apiserver/a\\\\    - --service-account-lookup=true\" /etc/kubernetes/manifests/kube-apiserver.yaml'",
      why: "The kubelet polls /etc/kubernetes/manifests and re-creates the pod when the file changes, so there is no manual restart - restartCount is your proof. If the pod falls into CrashLoopBackOff your flag was rejected: describe the pod, read the last state, undo." },
    { cmd: "kubectl delete job kube-bench; kubectl apply -f manifests/40-kube-bench.yaml; kubectl logs job/kube-bench | jq -c '.Results[] | {node_type, fails: [.tests[] | select(.status==\"fail\") | .test_number]}'",
      why: "A before and after diff of the same benchmark run is the whole answer. Some checks report FAIL or SKIP in kind because kind does not use real kubeadm file paths - name those instead of chasing them." }
  ],
  pitfalls: [
    "An invalid flag kills the API server and therefore the cluster: confirm with kubectl get --raw /readyz after every edit.",
    "Control-plane checks need the control-plane paths mounted. In kind, running kube-bench inside the control-plane container often reports more than a cluster Job does.",
    "Never fix a finding by deleting the component that produced it."
  ],
  related: ["cs-cis", "ch-api-access", "sh-os-footprint"]
},

/* ------------------------------------------------------------------ */
{
  id: "lab-03-ingress-tls", domain: "cluster-setup",
  title: "TLS at the edge, and the wrong answers that cost marks",
  difficulty: "medium", minutes: 20, timed: 12,
  scenario: "Expose payments-api through an Ingress with a self-signed certificate, force clients onto HTTPS, and be able to say why a TLS Secret in the cluster is not the same as a trusted certificate.",
  needs: ["kubectl", "curl or Invoke-WebRequest", "your cluster config maps the ingress controller to node ports 8080/8443"],
  files: ["manifests/60-ingress-tls.yaml"],
  tasks: [
    "Create a self-signed certificate and a kubernetes.io/tls Secret in prod.",
    "Create the Ingress that terminates TLS for api.prod.internal and redirects HTTP to HTTPS.",
    "Prove it against the kind node's published 443 port and show the chain is untrusted.",
    "Explain edge termination versus re-encrypt versus passthrough."
  ],
  verify: [
    "kubectl get ingress -n prod && kubectl get secret -n prod tls-api -o jsonpath='{.type}'",
    "curl -sk https://127.0.0.1:8443/healthz -H 'Host: api.prod.internal' -o /dev/null -w '%{http_code}\\n'",
    "curl -s -o /dev/null -w '%{http_code} %{redirect_url}\\n' http://127.0.0.1:8080/healthz -H 'Host: api.prod.internal'",
    "openssl s_client -connect 127.0.0.1:8443 -servername api.prod.internal -showcerts < /dev/null | head -20"
  ],
  solution: [
    { cmd: "openssl req -x509 -newkey rsa:2048 -nodes -days 30 -keyout tls.key -out tls.crt -subj '/CN=api.prod.internal' -addext 'subjectAltName=DNS:api.prod.internal'",
      why: "The subjectAltName decides whether a client accepts the handshake. PowerShell's New-SelfSignedCertificate works but exports in a format you must convert, and the exam terminal has openssl - practise the openssl path." },
    { cmd: "kubectl -n prod create secret tls tls-api --cert=tls.crt --key=tls.key",
      why: "Type kubernetes.io/tls with keys tls.crt and tls.key. A secret created as generic will not be picked up by the ingress controller, which is a very easy mark to lose." },
    { cmd: "kubectl apply -f manifests/60-ingress-tls.yaml; kubectl describe ingress api -n prod",
      why: "The annotations in the Ingress manifest force SSL redirect. Read the events in describe output: an ingress that never gets an address is a class or controller problem, not a certificate problem." },
    { cmd: "curl -sk https://127.0.0.1:8443/healthz -H 'Host: api.prod.internal' -v 2>&1 | grep -E 'subject|issuer|HTTP/'",
      why: "Self-signed means the identity is unverified: -k proves it works, and saying out loud that a browser would reject it proves you understand the difference between encryption in transit and authenticated encryption in transit." }
  ],
  pitfalls: [
    "kind publishes node ports 80/443 only if kind-config.yaml declares them; your extraPortMappings map them to 8080/8443, which is why the curl targets look odd.",
    "TLS terminates at the controller. Traffic from controller to Pod is plain HTTP unless you re-encrypt or run a mesh.",
    "An ingress with no default backend returns 404 for unmatched hosts, which is easy to mistake for a broken TLS setup."
  ],
  related: ["cs-ingress-tls", "ms-mtls"]
},

/* ------------------------------------------------------------------ */
{
  id: "lab-04-node-metadata", domain: "cluster-setup",
  title: "What can a Pod learn about its node, and how do you stop it",
  difficulty: "medium", minutes: 20, timed: 10,
  scenario: "A Pod in prod should not be able to read instance metadata, kubelet credentials or the node's process table. Prove what is reachable today, then close it.",
  needs: ["kubectl", "docker"],
  files: ["manifests/50-containment-netpol.yaml", "manifests/70-hostpath-probe.yaml"],
  tasks: [
    "From a probe Pod, try the metadata endpoint, the kubelet port 10250 and the read-only port 10255.",
    "Check whether the kubelet's anonymous authentication is enabled on the control-plane node.",
    "Close the reachable paths: NetworkPolicy for the metadata IP, and a kubelet configuration change.",
    "Explain why hostPath and hostNetwork Pods make the node's own credentials reachable from inside a Pod."
  ],
  verify: [
    "kubectl run probe -n prod --rm -it --image=busybox:1.36 --restart=Never -- sh -c 'wget -qO- --timeout=3 http://169.254.169.254/latest/meta-data/ || echo BLOCKED'",
    "docker exec cks-control-plane sh -c 'grep -E \"readOnlyPort|anonymous|authorization\" -A2 /var/lib/kubelet/kubeadm-flags.env /etc/kubernetes/kubelet.conf 2>/dev/null | head -30'",
    "kubectl run probe -n prod --rm -it --image=busybox:1.36 --restart=Never -- sh -c 'wget -qO- --timeout=3 --no-check-certificate https://cks-control-plane:10250/pods || echo NO_ACCESS'",
    "kubectl apply -f manifests/70-hostpath-probe.yaml && kubectl get pod hostpath-probe -n prod"
  ],
  solution: [
    { cmd: "docker exec cks-control-plane cat /var/lib/kubelet/config.yaml",
      why: "This is the KubeletConfiguration in a kubeadm cluster. readOnlyPort: 10255 with anonymous authentication is the classic node-metadata exposure: unauthenticated /pods gives you every Pod spec, secrets mounted as env and service-account tokens." },
    { cmd: "docker exec cks-control-plane sh -c 'sed -i \"s/readOnlyPort: 10255/readOnlyPort: 0/\" /var/lib/kubelet/config.yaml && grep -A3 authentication /var/lib/kubelet/config.yaml' && docker exec cks-control-plane sh -c 'pkill -TERM kubelet'; sleep 15; kubectl get nodes",
      why: "On a VM the kubelet is a systemd unit: systemctl restart kubelet. In kind the kubelet runs as a process inside the node container, so pkill is the equivalent. In the exam the harness restarts the service for you - know which one you are touching." },
    { cmd: "kubectl apply -f manifests/50-containment-netpol.yaml && kubectl run probe -n prod --rm -it --image=busybox:1.36 --restart=Never -- sh -c 'wget -qO- --timeout=3 http://169.254.169.254/ || echo BLOCKED'",
      why: "NetworkPolicy with an ipBlock except is the in-cluster answer. The host-level answers - link-local filtering in the CNI, cloud IAM that scopes the instance role, or a metadata proxy - are worth naming too, because in a managed cluster you often cannot change the CNI." },
    { cmd: "kubectl delete pod hostpath-probe -n prod",
      why: "The probe Pod mounts the host root read-only and shows how much is readable from inside a Pod: kubelet credentials, /etc/kubernetes/pki, container socket. Delete it rather than leaving a privileged Pod in your lab." }
  ],
  pitfalls: [
    "NetworkPolicy can only block the metadata IP if the CNI enforces egress ipBlock rules; on a cluster where it does not, use host routes or cloud IAM scoping.",
    "Blocking 169.254.169.254 does not stop a Pod that already holds a node's service-account token - check automountServiceAccountToken too.",
    "In kind the metadata endpoint is unreachable for a different reason than in cloud (there is no metadata service), so a BLOCKED result there is not proof your policy works: check the policy with the 10.10.0.0/16 variant in the drill."
  ],
  related: ["cs-node-metadata", "sh-external", "ch-serviceaccounts"]
},

/* ------------------------------------------------------------------ */
{
  id: "lab-05-binary-verify", domain: "cluster-setup",
  title: "Verify the platform binaries before you deploy them",
  difficulty: "easy", minutes: 15, timed: 8,
  scenario: "You are given a kubeadm binary and a checksum from a mirror. Show that what you are about to run is what the project published, and know what a signature does that a checksum cannot.",
  needs: ["a machine with curl, PowerShell or sha256sum", "no cluster needed"],
  files: ["supplychain/verify-binaries.ps1", "supplychain/verify-binaries.sh"],
  tasks: [
    "Download a kubeadm release artifact and its published SHA256 checksum file.",
    "Compare your computed digest against the published one, and check that the checksum file itself came from the release host over HTTPS.",
    "Verify a cosign-signed release the keyless way and name which identity you actually trusted.",
    "Write the two-sentence answer for why checksum plus signature is stronger than either alone."
  ],
  verify: [
    "Get-FileHash -Algorithm SHA256 .\\kubeadm | Format-List",
    "sha256sum kubeadm; cat kubeadm.sha256",
    "cosign verify-release-identity --help 2>&1 | head -5",
    "curl -sL https://dl.k8s.io/release/stable.txt"
  ],
  solution: [
    { cmd: "curl -sLO https://dl.k8s.io/release/v1.37.0/bin/linux/amd64/kubeadm && curl -sLO https://dl.k8s.io/release/v1.37.0/bin/linux/amd64/kubeadm.sha256 && sha256sum -c kubeadm.sha256",
      why: "sha256sum -c compares against a published digest instead of you eyeballing hex. The step that people skip: the checksum is only as trustworthy as the channel it arrived on, which is why HTTPS from the release host matters." },
    { cmd: "cosign verify --certificate-oidc-issuer https://oidc.eksa.pkg.dev --certificate-identity-regexp 'https://github.com/kubernetes/kubernetes/.*' <registry>/k8s-artifacts-prod/kubeadm:<version>",
      why: "This is the release-signing flow for published container images. Verify the issuer and the identity regex before you call a binary signed: a signature from an attacker-controlled workload identity verifies successfully and means nothing." },
    { cmd: "gpg --verify kubeadm.sig kubeadm 2>&1 | head -8",
      why: "The tarball signing path uses a project GPG key. Knowing both paths - cosign for registry artifacts, GPG for release tarballs - is what makes the 'verify platform binaries' competency answerable in either exam environment." }
  ],
  pitfalls: [
    "A digest you computed on the same host you downloaded from proves integrity, not authenticity.",
    "Version numbers move: confirm the version your cluster actually runs (kubectl version) before downloading a binary to match it.",
    "On Windows, Get-FileHash and certutil are the equivalents of sha256sum; the exam terminal is Linux, so practise the Linux form."
  ],
  related: ["cs-binary-verify", "sc-sign", "sc-supply"]
},

/* ------------------------------------------------------------------ */
{
  id: "lab-06-rbac", domain: "cluster-hardening",
  title: "Least privilege, then prove it from the subject's point of view",
  difficulty: "medium", minutes: 25, timed: 15,
  scenario: "Namespace app needs a CI identity that can read Pods and logs but nothing else, and an auditor wants to know who currently holds cluster-admin.",
  needs: ["kubectl"],
  files: ["manifests/80-rbac.yaml"],
  tasks: [
    "Create ServiceAccount ci-sa in app with a Role and RoleBinding for pods and pods/log only.",
    "Prove the grant with kubectl auth can-i as that identity, and prove the negative for something it must not have.",
    "Find every binding of cluster-admin and every ServiceAccount holding a ClusterRoleBinding.",
    "Show that the identity cannot grant itself rights it does not have."
  ],
  verify: [
    "kubectl auth can-i get pods/log --as=system:serviceaccount:app:ci-sa",
    "kubectl auth can-i delete deployments --as=system:serviceaccount:app:ci-sa",
    "kubectl auth can-i --list --as=system:serviceaccount:app:ci-sa -n app",
    "kubectl auth can-i bind clusterroles/cluster-admin --as=dev-lead",
    "kubectl get clusterrolebindings -o json | jq -r '.items[] | select(.roleRef.name==\"cluster-admin\") | .metadata.name'"
  ],
  solution: [
    { cmd: "kubectl apply -f manifests/80-rbac.yaml && kubectl auth can-i --list --as=system:serviceaccount:app:ci-sa -n app",
      why: "The list output is the answer a grader reads. A RoleBinding whose roleRef.kind is ClusterRole silently widens the grant to the whole cluster, so check roleRef in the same breath as the rules." },
    { cmd: "kubectl create clusterrolebinding ci-sa-admin --clusterrole=cluster-admin --serviceaccount=app:ci-sa --dry-run=client -o yaml | head -20",
      why: "Dry-run the escalation you are being asked to prevent, then delete nothing: kubectl auth can-i bind clusterroles/cluster-admin --as=<subject> is the supported way to show RBAC escalation prevention is intact." },
    { cmd: "kubectl get clusterrolebindings,rolebindings -A -o json | jq -r '.items[] | select(.subjects[]?.kind==\"ServiceAccount\") | [.metadata.namespace, .metadata.name, .roleRef.name] | @tsv'",
      why: "Workload identities with cluster-wide roles are the persistence vector in real incidents. This one line is the inventory you would show a reviewer." },
    { cmd: "kubectl create token ci-sa -n app --audience=ci.example.internal --duration=600s | cut -d. -f2 | base64 -d 2>/dev/null | head -c 400",
      why: "RBAC plus a short-lived, audience-bound token is the pair. The token claims show aud, exp and sub - which is how you prove the credential is scoped as well as the permission." }
  ],
  pitfalls: [
    "verbs bind and escalate exist precisely so a subject cannot grant rights they do not hold - name them.",
    "pods/log is a subresource: granting pods does not grant logs, and vice versa.",
    "kubectl auth can-i --list as cluster-admin proves nothing; always test as the identity in question."
  ],
  related: ["ch-rbac", "ch-serviceaccounts", "rt-ir"]
},

/* ------------------------------------------------------------------ */
{
  id: "lab-07-serviceaccounts", domain: "cluster-hardening",
  title: "ServiceAccount hygiene, including the legacy token you did not create",
  difficulty: "medium", minutes: 20, timed: 12,
  scenario: "Every namespace's default ServiceAccount is automounting a token into every Pod, and one namespace still has a Secret of type service-account-token. Clean both up and prove a workload still works.",
  needs: ["kubectl"],
  files: ["manifests/00-cluster-base.yaml", "manifests/80-rbac.yaml"],
  tasks: [
    "Inventory which ServiceAccounts exist, which carry Secrets of type kubernetes.io/service-account-token, and which Pods are mounting tokens.",
    "Turn off automounting at ServiceAccount and Pod level, then mount a projected token with an audience and a 10 minute lifetime.",
    "Delete a legacy token Secret and show that the controller recreates it only when the ServiceAccount is used without the opt-out.",
    "Confirm what the workload can do with the new token."
  ],
  verify: [
    "kubectl get sa -A -o json | jq -r '.items[] | [.metadata.namespace, .metadata.name, (.automountServiceAccountToken|tostring)] | @tsv'",
    "kubectl get secrets -A -o json | jq -r '.items[] | select(.type==\"kubernetes.io/service-account-token\") | .metadata.namespace + \"/\" + .metadata.name'",
    "kubectl get pods -A -o json | jq -r '.items[] | select(any(.spec.volumes[]?; .projected != null or .secret != null)) | .metadata.namespace + \"/\" + .metadata.name'",
    "kubectl exec -it hardened-api -n prod -- sh -c 'ls -l /var/run/secrets/kubernetes.io/serviceaccount 2>/dev/null || echo NO_AUTOMOUNT'"
  ],
  solution: [
    { cmd: "kubectl patch serviceaccount default -n prod -p '{\"automountServiceAccountToken\": false}'",
      why: "Namespace default is the highest-leverage switch: it covers every Pod that does not say otherwise. Say the tradeoff out loud - a workload that needs the API will now fail, and that failure is the point." },
    { cmd: "kubectl apply -f manifests/95-hardened.yaml && kubectl exec -it hardened-api -n prod -- sh -c 'cat /var/run/secrets/api/token | head -c 60; echo'",
      why: "The projected volume gives you an audience-bound, expiring credential in a path your app chooses. Compare the two reads of the file to watch the token rotate before expirationSeconds." },
    { cmd: "kubectl delete secret ci-sa-token -n app 2>/dev/null; kubectl get secret -n app -o json | jq -r '.items[] | select(.type==\"kubernetes.io/service-account-token\") | .metadata.name'",
      why: "Legacy token Secrets are created by the controller for ServiceAccounts that request them (an annotation or an explicit Secret). Deleting one while the annotation remains brings it back: remove the request, then the Secret. That order is the graded detail." }
  ],
  pitfalls: [
    "Disabling automounting breaks in-cluster clients that read the default path - name which workloads you would have to change.",
    "A projected token is not mounted until the Pod starts, so an existing Pod needs a rollout before the change takes effect.",
    "kubectl describe secret on a legacy token Secret prints the token itself. Never paste that into a shared terminal during a live session."
  ],
  related: ["ch-serviceaccounts", "ch-rbac", "ms-secrets"]
},

/* ------------------------------------------------------------------ */
{
  id: "lab-08-api-access", domain: "cluster-hardening",
  title: "Who can reach the API, and from where",
  difficulty: "hard", minutes: 30, timed: 18,
  scenario: "Close the API server to anonymous access, make sure nodes can only manage themselves, and confirm from both inside and outside the cluster that access is what you intended.",
  needs: ["kubectl", "docker"],
  files: ["manifests/00-cluster-base.yaml"],
  tasks: [
    "Read the current kube-apiserver flags on the control-plane container and list the ones that decide access.",
    "Set anonymous auth off, authorization-mode to Node,RBAC, NodeRestriction enabled, and service-account-lookup on - one at a time, verifying between edits.",
    "Show what a node is allowed to do versus what a random Pod's ServiceAccount is allowed to do.",
    "Test the external path: from the kind network, is port 6443 reachable, and what does an unauthenticated request return?"
  ],
  verify: [
    "kubectl get --raw /healthz 2>&1 | head -2",
    "curl -sk https://127.0.0.1:8443/api 2>&1 | head -5",
    "kubectl auth can-i --list --as=system:node:cks-worker",
    "kubectl auth can-i create pods --as=system:serviceaccount:prod:default -n prod",
    "kubectl -n kube-system logs kube-apiserver-cks-control-plane --tail=40 | grep -iE 'anonymous|noderestriction|denied' | head"
  ],
  solution: [
    { cmd: "docker exec cks-control-plane sh -c 'grep -E \"^    - --\" /etc/kubernetes/manifests/kube-apiserver.yaml'",
      why: "Start from what is actually set. In the exam the flags are partly there already and the task is to change two of them, not to rewrite the file." },
    { cmd: "docker exec cks-control-plane sh -c 'sed -i \"/    - kube-apiserver/a\\\\    - --anonymous-auth=false\\n    - --service-account-lookup=true\" /etc/kubernetes/manifests/kube-apiserver.yaml'; sleep 25; kubectl get nodes && kubectl get --raw /readyz",
      why: "Two edits, one restart, then verify. service-account-lookup makes the API server check that a ServiceAccount exists before accepting its token, which is what stops a deleted identity from keeping access." },
    { cmd: "kubectl run probe -n prod --rm -it --image=busybox:1.36 --restart=Never -- sh -c 'wget -qO- --no-check-certificate --header=\"Authorization: Bearer $(cat /var/run/secrets/kubernetes.io/serviceaccount/token 2>/dev/null)\" https://kubernetes.default.svc/api/v1/namespaces | head -5'",
      why: "This is the lateral path an attacker takes from inside a Pod. The answer is usually 403 because RBAC denies it - prove it rather than assert it." },
    { cmd: "docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' cks-lb; kubectl -n kube-system get configmap",
      why: "In kind the load balancer container is the external entry point; on a real cluster the equivalent question is whether 6443 is exposed on a public interface and what firewall or private endpoint fronts it." }
  ],
  pitfalls: [
    "anonymous-auth=false does not remove the system:anonymous Group from RBAC bindings that still grant it rights - audit the bindings too.",
    "NodeRestriction only limits a kubelet acting as system:node:<name>; it does nothing for a Pod identity.",
    "Restarting the API server drops your kubectl connection mid-edit: expect the retry, do not panic and do not edit the file again while it is coming up."
  ],
  related: ["ch-api-access", "ch-rbac", "cs-cis"]
},

/* ------------------------------------------------------------------ */
{
  id: "lab-09-upgrade", domain: "cluster-hardening",
  title: "The upgrade sequence, written and rehearsed",
  difficulty: "hard", minutes: 30, timed: 20,
  scenario: "Your cluster is one minor version behind a CVE fix. Practise the order of operations on a real cluster and be able to recite it under time pressure: check, drain, upgrade, verify, resume.",
  needs: ["kubectl", "docker", "kind"],
  files: ["kind-config.yaml"],
  tasks: [
    "Record the current versions of control plane, kubelet and kubectl, and the version gap that matters.",
    "Write the ordered kubeadm sequence for a control-plane node and a worker, including cordon, drain with the right flags, upgrade, uncordon.",
    "Rehearse a worker replacement in kind by recreating one node at a newer image, and observe what a drain actually protects.",
    "List what you would check after the upgrade: nodes Ready, components restarted, workloads Running, and the API still healthy."
  ],
  verify: [
    "kubectl version -o json | jq -r '.components[] | [.component, .gitVersion] | @tsv'",
    "kubectl get nodes -o custom-columns=NAME:.metadata.name,KUBELET:.status.nodeInfo.kubeletVersion,OS:.status.nodeInfo.osImage",
    "kubectl drain cks-worker --ignore-daemonsets --delete-emptydir=true --grace-period=60",
    "kubectl get nodes && kubectl cordon cks-worker && kubectl uncordon cks-worker",
    "kubectl get pods -A -o wide | grep -v Running | head -20"
  ],
  solution: [
    { cmd: "kubectl drain cks-worker --ignore-daemonsets --delete-emptydir=true --grace-period=60; kubectl get nodes",
      why: "drain refuses to evict DaemonSets and Pods using emptyDir unless you say so - those flags are part of the answer, not noise. The node stays Cordoned until you uncordon it, which is why the sequence includes the last step." },
    { cmd: "kubeadm upgrade plan   # run this on the control-plane host, not on your laptop",
      why: "The order the exam expects, recited in order: (1) on the FIRST control plane, kubeadm upgrade plan then kubeadm upgrade apply v1.xx.y; (2) on that node, apt/dnf install the matching kubelet and kubeadm, then systemctl daemon-reload && systemctl restart kubelet; (3) uncordon it; (4) on every remaining control plane, kubeadm upgrade node, then the same kubelet upgrade and restart; (5) drain each worker one at a time, run kubeadm upgrade node on it, upgrade its kubelet, uncordon; (6) verify nodes Ready on the new version before touching the next one. Control plane first, workers second: a kubelet must never be newer than the API server it talks to." },
    { cmd: "kind delete cluster --name cks; kind create cluster --name cks --config kind-config.yaml   # with image: kindest/node:v1.37.0 in the config",
      why: "kind cannot upgrade a node in place, so the honest rehearsal of node replacement is teardown and recreate at the newer image, while you watch a controller reschedule the workloads you drained. That is the part a lab can actually show you; kubeadm upgrade apply is the part you must be able to recite without a lab." },
    { cmd: "kubectl get pods -n kube-system -o wide; kubectl get --raw /readyz; kubectl top nodes 2>/dev/null",
      why: "Post-upgrade verification is a checklist a grader can hear: every node Ready on the new version, every kube-system component Running, control-plane static pods restarted, no Pod stuck in CrashLoopBackOff, and the previous version recorded in case you must roll back." }
  ],
  pitfalls: [
    "Version skew matters: kubelet must not be newer than the API server it talks to. Upgrade control plane first, workers second.",
    "Draining a node with local-path storage in kind can lose data - that is a lesson about PersistentVolumes, not about drain.",
    "kubeadm upgrade apply runs once on the first control plane; upgrade node is what the other members run. Mixing them up is a classic lost mark."
  ],
  related: ["ch-upgrade", "cs-cis"]
},

/* ------------------------------------------------------------------ */
{
  id: "lab-10-kernel-hardening", domain: "system-hardening",
  title: "AppArmor and seccomp, with honest lab limits",
  difficulty: "hard", minutes: 25, timed: 15,
  scenario: "Write a custom AppArmor profile and a custom seccomp profile, apply both through securityContext, and know exactly why your Docker Desktop lab cannot show you the AppArmor part.",
  needs: ["kubectl", "a Linux VM for the AppArmor proof (kind on Docker Desktop cannot load profiles)"],
  files: ["manifests/30-bad-pod.yaml", "manifests/95-hardened.yaml", "/etc/apparmor.d/app-api", "/var/lib/kubelet/seccomp/app-seccomp.json"],
  tasks: [
    "Check what the host supports today: AppArmor status, seccomp availability, and the runtime.",
    "Write the AppArmor profile and the Pod that requests it, and prove on a VM that the profile blocks a write it should block.",
    "Write a seccomp profile that starts from the runtime default and adds one syscall group, then verify the Pod is confined.",
    "Explain when RuntimeDefault is enough and when a custom profile is worth the maintenance cost."
  ],
  verify: [
    "docker exec cks-control-plane sh -c 'apparmor_status 2>&1 | head -5 || echo APPARMOR_NOT_AVAILABLE'",
    "docker exec cks-control-plane sh -c 'grep -i apparmor /boot/config-$(uname -r) 2>/dev/null | head -5; zcat /proc/config.gz 2>/dev/null | grep -i apparmor | head -5'",
    "kubectl get pod hardened-api -n prod -o jsonpath='{.spec.containers[0].securityContext.seccompProfile}'",
    "kubectl run sc-unconfined -n prod --rm -it --image=busybox:1.36 --restart=Never --overrides='{\"apiVersion\":\"v1\",\"spec\":{\"securityContext\":{\"seccompProfile\":{\"type\":\"Unconfined\"}}}}' -- sh -c 'grep -i seccomp /proc/self/status'",
    "kubectl run sc-default -n prod --rm -it --image=busybox:1.36 --restart=Never --overrides='{\"apiVersion\":\"v1\",\"spec\":{\"securityContext\":{\"seccompProfile\":{\"type\":\"RuntimeDefault\"}}}}' -- sh -c 'grep -i seccomp /proc/self/status'"
  ],
  solution: [
    { cmd: "kubectl apply -f manifests/95-hardened.yaml && kubectl get pod hardened-api -n prod -o jsonpath='{.spec.containers[0].securityContext}'",
      why: "seccompProfile type RuntimeDefault is the answer you can prove in any cluster. It is also the answer PSA restricted requires, so it is worth getting right even when the host has nothing fancier." },
    { cmd: "# run the two overrides from the verify list and compare the numbers:\n#   Seccomp:\t0  -> no filtering at all (Unconfined)\n#   Seccomp:\t2  -> filtering active (a profile is applied)\nkubectl run sc-default -n prod --rm -it --image=busybox:1.36 --restart=Never --overrides='{\"apiVersion\":\"v1\",\"spec\":{\"securityContext\":{\"seccompProfile\":{\"type\":\"RuntimeDefault\"}}}}' -- sh -c 'grep -i seccomp /proc/self/status; grep -i seccomp_filters /proc/self/status'",
      why: "This is the only way to see seccomp working without a custom profile on the host: the kernel reports the mode and the number of filters attached to the process. Unconfined reads 0, RuntimeDefault reads 2 with a filter count above zero - proof you can show a reviewer." },
    { cmd: "# On a VM with AppArmor enabled:\nscp app-api.profile node:/etc/apparmor.d/app-api\nssh node 'apparmor_parser -r /etc/apparmor.d/app-api && aa-status | head -20'",
      why: "AppArmor is a host feature. The profile file must exist on the node and be loaded in enforce mode before the Pod starts, otherwise the Pod fails with a profile-not-found error and no manifest edit will fix it." },
    { cmd: "ssh node 'kubectl apply -f app-api-pod.yaml && kubectl exec app-api -- sh -c \"echo x > /etc/attempt || echo DENIED_BY_APPARMOR\"'",
      why: "The deny rule is what you demonstrate. If the write succeeds, the profile is in complain mode or not attached to that container - check aa-status and the profile name in securityContext.appArmorProfile.localhostProfile." },
    { cmd: "# Custom seccomp: copy the runtime base profile, then add your syscalls\nssh node 'cp /usr/share/containers/seccomp.json /var/lib/kubelet/seccomp/app-seccomp.json && chmod 644 /var/lib/kubelet/seccomp/app-seccomp.json'",
      why: "A custom profile replaces the runtime default rather than layering on top of it, so it must contain the full syscall list. Extract the base profile from the runtime instead of writing a short list and losing syscalls the application needs." }
  ],
  pitfalls: [
    "AppArmor and SELinux are host-level and mutually exclusive in practice: know which one your target platform uses.",
    "kindest/node has AppArmor userspace absent, so this lab proves the manifest part and not the enforcement part - say so in an exam answer rather than claiming a demo.",
    "A seccomp profile that is too tight shows up as an application that cannot start, which looks like an image bug. Diff your profile against the runtime default before you ship it."
  ],
  related: ["sh-apparmor", "sh-seccomp", "ms-psa"]
},

/* ------------------------------------------------------------------ */
{
  id: "lab-11-os-footprint", domain: "system-hardening",
  title: "Shrink what the node and the image can do",
  difficulty: "medium", minutes: 25, timed: 12,
  scenario: "Two attack surfaces in one sitting: what is listening on the node, and what is inside your image. Reduce both, and be able to show the difference before and after.",
  needs: ["kubectl", "docker"],
  files: ["manifests/30-bad-pod.yaml", "supplychain/Dockerfile"],
  tasks: [
    "List what is listening on the control-plane node and decide which of those should be reachable from outside the node.",
    "Build the same Dockerfile two ways - a full base image and the distroless one - and compare size, package count and available shells.",
    "Deploy the minimal image and show that kubectl exec into it has no shell to give an attacker.",
    "List three node-level footprint reductions you would make on a real host."
  ],
  verify: [
    "docker exec cks-control-plane sh -c 'ss -tlnp | head -20'",
    "docker exec cks-control-plane sh -c 'ps -eo comm,rss --sort=-rss | head -12'",
    "docker images --format '{{.Repository}}:{{.Tag}} {{.Size}}' | grep cks-lab",
    "kubectl exec -it minimal-api -n prod -- sh 2>&1 | head -3"
  ],
  solution: [
    { cmd: "docker exec cks-control-plane sh -c 'ss -tlnp'",
      why: "10250 (kubelet), 2379/2380 (etcd), 6443 (API server) and 10256/10257 (healthz and the controller manager) are the node's real attack surface. Footprint reduction is about which of those are bound to a reachable interface." },
    { cmd: "cd supplychain; docker build -t cks-lab/api:full -f Dockerfile.full . ; docker build -t cks-lab/api:minimal . ; docker images | grep cks-lab",
      why: "The size difference is the headline; the real proof is what the container can do. docker history shows the layers that carried a compiler and a package manager into the fat image." },
    { cmd: "kubectl run minimal-api -n prod --rm -it --image=cks-lab/api:minimal --restart=Never 2>&1 | head -3; docker run --rm --entrypoint ls cks-lab/api:minimal -la /",
      why: "'kubectl exec gives me a shell' is the demonstration. In a distroless or scratch image there is no shell: debugging then requires an ephemeral debug container with a shared process namespace, which is the skill the exam is checking." }
  ],
  pitfalls: [
    "A minimal image with no shell is only immutable if the root filesystem is read-only too - the two controls are usually graded together.",
    "Node footprint answers must be specific to the node: remove unused services, bind administrative ports to loopback or an internal interface, keep the OS patched, and run nothing else on it.",
    "distroless images differ (static, base, cc, nonroot variants). Name the one you chose and why."
  ],
  related: ["sh-os-footprint", "sc-base-image", "rt-immutability"]
},

/* ------------------------------------------------------------------ */
{
  id: "lab-12-iam-external", domain: "system-hardening",
  title: "Identity for the nodes, the pipeline and the people",
  difficulty: "medium", minutes: 20, timed: 10,
  scenario: "Nothing here is a Kubernetes manifest: the task is who the cluster's principals are, what each may do, and how a human reaches the API without a public endpoint.",
  needs: ["kubectl", "a cloud or on-prem answer you can write down"],
  files: ["manifests/80-rbac.yaml"],
  tasks: [
    "Separate the principals: node identity, CI identity, and operator identity. Write what each one may do and what must be impossible for it.",
    "Show the Kubernetes-side grant for the CI identity and the short-lived credential that goes with it.",
    "Describe how operators reach the API in a private cluster: bastion, VPN or private endpoint - and why the shared cluster-admin kubeconfig is the wrong answer.",
    "List the audit evidence that would show whether any of those identities is over-privileged today."
  ],
  verify: [
    "kubectl get sa -A --no-headers | wc -l && kubectl get secrets -A --no-headers | wc -l",
    "kubectl auth can-i --list --as=system:serviceaccount:app:ci-sa",
    "kubectl get clusterrolebindings -o json | jq -r '.items[] | .roleRef.name' | sort | uniq -c | sort -rn | head",
    "kubectl create token ci-sa -n app --audience=ci.example.internal --duration=600s | cut -d. -f2 | base64 -d 2>/dev/null | head -c 300"
  ],
  solution: [
    { cmd: "# one role per node pool, scoped to what the node actually needs; attach it via the instance profile, never a key on the host\n# the CI identity gets its own role and its own kubeconfig, with a token that expires",
      why: "The answer is a separation claim: a leaked CI credential must not be able to read a node's instance-profile credentials, and a leaked operator kubeconfig must not be cluster-admin. Name the three principals before you name any tool." },
    { cmd: "kubectl apply -f manifests/80-rbac.yaml && kubectl auth can-i --list --as=system:serviceaccount:app:ci-sa -n app",
      why: "RBAC is the Kubernetes half of IAM. The cloud half is instance profiles, workload identity federation, and scoped roles - and the exam accepts a written answer with the right shape." },
    { cmd: "# operators reach the API through a bastion or VPN against a private endpoint;\n# per-identity access issued through OIDC or the cloud provider's exec plugin, short-lived\nkubectl config view --minify -o jsonpath='{.clusters[0].cluster.server}'",
      why: "The public-6443 pattern is the failure mode. Saying 'private endpoint plus a per-identity short-lived credential, with the audit log proving who used what' is the complete answer." }
  ],
  pitfalls: [
    "Node instance profiles are the credential an attacker wants most: a Pod that can read the metadata service can use them.",
    "kubectl proxy or a dashboard exposed publicly is an external access finding, not a convenience.",
    "Long-lived kubeconfig files in a repo are the most common real-world version of this failure."
  ],
  related: ["sh-iam", "sh-external", "ch-rbac"]
},

/* ------------------------------------------------------------------ */
{
  id: "lab-13-psa", domain: "microservices",
  title: "Pod Security Admission: warn, audit, enforce, and fix what breaks",
  difficulty: "medium", minutes: 25, timed: 15,
  scenario: "Namespace prod must run restricted. Turn the modes on in the order a real team would, find every workload that violates the policy, and fix the workloads instead of relaxing the policy.",
  needs: ["kubectl", "kubectl audit wrapper from the Learn page for the direct API test"],
  files: ["manifests/30-bad-pod.yaml", "manifests/90-psa-namespaces.yaml", "manifests/95-hardened.yaml"],
  tasks: [
    "Put prod in warn mode only, apply the violating manifests, and read the warnings the API server writes to kubectl's stderr.",
    "Add audit mode and find the audit annotations on the objects that were admitted anyway.",
    "Switch to enforce and watch the rejected create. Then fix each violation one at a time, in order.",
    "Prove the same behaviour against the API path that bypasses kubectl."
  ],
  verify: [
    "kubectl get ns prod -o jsonpath='{.metadata.labels}'",
    "kubectl apply -f manifests/30-bad-pod.yaml 2>&1 | head -20",
    "kubectl get pod bad-root -n prod -o jsonpath='{.metadata.annotations.pod-security\\.kubernetes\\.io/audit-pod-restricted}' 2>&1 | head -3",
    "kubectl exec -it hardened-api -n prod -- sh 2>&1 | head -2",
    "python3 api-pod-create.py 2>&1 | tail -5"
  ],
  solution: [
    { cmd: "kubectl label ns prod pod-security.kubernetes.io/warn=restricted --overwrite && kubectl label ns prod pod-security.kubernetes.io/audit=restricted --overwrite",
      why: "warn first, then audit, then enforce. Skipping straight to enforce is how a namespace-wide outage starts; the graded skill is the sequence, not the label alone." },
    { cmd: "kubectl apply -f manifests/30-bad-pod.yaml",
      why: "In warn and audit mode the objects are admitted, so you get a list of what you still have to fix while the cluster keeps running. Read the annotations on the admitted objects - they name the exact field that violated the policy." },
    { cmd: "kubectl label ns prod pod-security.kubernetes.io/enforce=restricted --overwrite && kubectl apply -f manifests/95-hardened.yaml",
      why: "Enforce rejects new requests only. Existing violating Pods keep running, which is the detail most people miss: enforce is not a scan of what is already there. Fix workloads by replacing them, one at a time, and keep the enforce level below any level you would need for privileged tooling." },
    { cmd: "kubectl run bad-priv -n prod --image=nginx:1.27 --privileged 2>&1 | head -3",
      why: "The rejection message is the exam's own message. Being able to say which line of the Pod caused it - allowPrivilegeEscalation, runAsUser 0, hostPath, hostNetwork - is the answer a grader is looking for." }
  ],
  pitfalls: [
    "enforce, audit and warn may carry different versions (for example enforce=baseline, audit=restricted) during an adoption - that is a legitimate staged rollout.",
    "A DaemonSet that needs privileged access cannot live in a namespace enforcing restricted; it needs its own namespace at the lower level.",
    "PSA validates Pod specs at creation. It does not validate a Deployment's template until a ReplicaSet creates a Pod from it, so a Deployment can sit with 0 available replicas and a rejection hidden in the ReplicaSet's events."
  ],
  related: ["ms-psa", "ms-policy", "sh-apparmor"]
},

/* ------------------------------------------------------------------ */
{
  id: "lab-14-kyverno", domain: "microservices",
  title: "Install Kyverno, then move one policy from audit to enforce",
  difficulty: "hard", minutes: 30, timed: 18,
  scenario: "PSA cannot express 'every image must come from our registry' or 'no image may be pulled by tag'. Kyverno can. Install it, write one deny rule and one mutate rule, and move them into production the way a platform team would.",
  needs: ["kubectl", "helm"],
  files: ["manifests/91-kyverno.yaml", "manifests/30-bad-pod.yaml"],
  tasks: [
    "Install Kyverno in its own namespace and wait for the webhook to be Ready.",
    "Apply the ClusterPolicy in audit mode and read the annotations it leaves on violating objects.",
    "Raise it to enforce and prove a violating create is refused with Kyverno's message.",
    "Add a mutate rule that stamps a default securityContext onto Pods that omit one, and confirm the mutation actually happened."
  ],
  verify: [
    "kubectl get pods -n kyverno && kubectl get deploy kyverno-admission-controller -n kyverno -o jsonpath='{.status.conditions}'",
    "kubectl get clusterpolicy -o custom-columns=NAME:.metadata.name,MODE:.spec.validationFailureAction,ACTION:.spec.rules[0].validation.action",
    "kubectl apply -f manifests/30-bad-pod.yaml 2>&1 | head -8",
    "kubectl run mutated -n prod --image=busybox:1.36 --restart=Never -- sleep 3600 && kubectl get pod mutated -n prod -o jsonpath='{.spec.containers[0].securityContext}' && kubectl delete pod mutated -n prod",
    "kubectl get pod bad-priv -n prod -o jsonpath='{.metadata.annotations}' 2>&1 | head -5"
  ],
  solution: [
    { cmd: "helm repo add kyverno https://kyverno.github.io/kyverno/ && helm repo update && helm install kyverno kyverno/kyverno -n kyverno --create-namespace --wait",
      why: "Kyverno is a webhook: install it in its own namespace with its own PSA level, and confirm the admission controller is Ready before you create any policy. A policy applied while the webhook is not Ready either fails closed or silently does nothing, depending on failurePolicy." },
    { cmd: "kubectl apply -f manifests/91-kyverno.yaml && kubectl explain clusterpolicy.spec.rules.verifyImages --recursive 2>&1 | head -40",
      why: "Read the schema on the cluster instead of trusting a remembered field name. Kyverno's API surface moves between releases, and kubectl explain is available in the exam exactly when you need it." },
    { cmd: "kubectl patch clusterpolicy no-privileged-pods --type merge -p '{\"spec\":{\"validationFailureAction\":\"Enforce\"}}' && kubectl apply -f manifests/30-bad-pod.yaml 2>&1 | head -6",
      why: "Audit first, Enforce second, in production order. The refusal message names the policy and the rule, which is the difference between a diagnosable outage and a mysterious one." },
    { cmd: "kubectl logs deploy/kyverno-admission-controller -n kyverno --tail=60 | grep -iE 'deny|mutated|error' | head -20",
      why: "Kyverno's own log is the evidence source. When a policy is 'not working', the log says whether the webhook matched the resource at all - the most common cause is a matchExpressions selection that excludes your test namespace." }
  ],
  pitfalls: [
    "Kyverno is cluster-scoped by default: match excluding kube-system is not optional, because a policy that rewrites control-plane Pods is an outage.",
    "failurePolicy: Ignore means the cluster admits whatever it wanted to block when Kyverno is down.",
    "A mutate rule that is not anchored by exclude on already-compliant Pods mutates the same field over and over, which shows up as confusing annotation churn."
  ],
  related: ["ms-policy", "ms-psa", "sc-sign"]
},

/* ------------------------------------------------------------------ */
{
  id: "lab-15-secrets", domain: "microservices",
  title: "Encryption at rest, verification, and the rotation order",
  difficulty: "hard", minutes: 35, timed: 20,
  scenario: "Secrets are encrypted in etcd with one key. Add a new key, make it primary, re-encrypt everything, and remove the old key - in the right order, with evidence at each step.",
  needs: ["kubectl", "docker (for etcdctl and the manifest edit)", "openssl or pwsh to generate a key"],
  files: ["manifests/00-cluster-base.yaml"],
  tasks: [
    "Read the live EncryptionConfiguration on the control plane and say which provider is primary today.",
    "Prove ciphertext in etcd for a real Secret.",
    "Append a new aescbc key, promote it to primary, restart, and force a rewrite of every Secret.",
    "Confirm the old key is unused, then remove it and restart again."
  ],
  verify: [
    "docker exec cks-control-plane cat /etc/kubernetes/encryption-provider.yaml",
    "docker exec cks-etcd etcdctl get /registry/secrets/prod/payments-key --print-value-only --cacert /etc/kubernetes/pki/etcd/ca.crt --cert /etc/kubernetes/pki/etcd/server.crt --key /etc/kubernetes/pki/etcd/server.key | cut -c1-80",
    "kubectl get secrets -A --no-headers | wc -l",
    "kubectl get secrets -A -o json | jq -r '.items[] | select(.data != null) | .metadata.namespace + \"/\" + .metadata.name' | head -5",
    "kubectl -n kube-system get pod kube-apiserver-cks-control-plane -o jsonpath='{.status.containerStatuses[0].restartCount}' && kubectl get --raw /readyz"
  ],
  solution: [
    { cmd: "docker exec cks-control-plane sh -c 'NEW=$(head -c 32 /dev/urandom | base64); printf \"providers:\\n- identity:\\n  aescbc:\\n    keys:\\n    - name: key2\\n      secret: %s\\n- aescbc:\\n    keys:\\n    - name: key1\\n      secret: %s\\n\" \"$NEW\" \"$(grep -A2 name: /etc/kubernetes/encryption-provider.yaml | grep secret: | head -1 | awk \"{print \\$2}\")\" > /etc/kubernetes/encryption-provider.yaml.new && cat /etc/kubernetes/encryption-provider.yaml.new'",
      why: "The order you write matters more than the key: identity first (read old, write new), aescbc second (primary, new key). Generate 32 random bytes and keep the old key in the file - removing it in the same edit is the mistake that makes old Secrets unreadable." },
    { cmd: "docker exec cks-control-plane sh -c 'mv /etc/kubernetes/encryption-provider.yaml.new /etc/kubernetes/encryption-provider.yaml'; sleep 30; kubectl get --raw /readyz && kubectl -n kube-system get pod kube-apiserver-cks-control-plane",
      why: "The kubelet notices the static pod manifest is unchanged but the mounted file changed, so on kind the reliable step is to bounce the pod: docker exec cks-control-plane sh -c 'crictl pods --name kube-apiserver | head' then delete the pod with kubectl -n kube-system delete pod kube-apiserver-cks-control-plane. In the exam the file is watched and the pod restarts; verify either way with restartCount and /readyz." },
    { cmd: "kubectl get secrets -A -o name | xargs -n1 -I{} sh -c 'kubectl get {} -o yaml | kubectl apply --force --validate=false -f -' > /dev/null; kubectl create secret generic rotate-probe -n prod --from-literal=x=1 && docker exec cks-etcd etcdctl get /registry/secrets/prod/rotate-probe --print-value-only --cacert /etc/kubernetes/pki/etcd/ca.crt --cert /etc/kubernetes/pki/etcd/server.crt --key /etc/kubernetes/pki/etcd/server.key | cut -c1-60",
      why: "Nothing rewrites existing objects until something writes them. A no-op apply is the standard force-rewrite, and reading the stored value afterwards is the evidence: the k8s:enc:aescbc:v1:key2 marker proves which key is in use." },
    { cmd: "docker exec cks-control-plane sh -c 'grep -c key1 /etc/kubernetes/encryption-provider.yaml' && docker exec cks-control-plane sh -c 'sed -i \"/key1/,+2d\" /etc/kubernetes/encryption-provider.yaml'; sleep 30; kubectl get secrets -n prod && kubectl get --raw /readyz",
      why: "Only after every Secret has been re-read and re-written with the new primary may the old key disappear. Delete it too early and any object still carrying it becomes undecryptable - that is the sentence the task is grading." }
  ],
  pitfalls: [
    "Encryption at rest does not hide Secret data from kubectl, RBAC or a user who can GET a Secret. It protects the etcd data on disk and in backups.",
    "The provider list semantics in one sentence: writes use the FIRST provider in the list, reads attempt every provider in it. Memorise it that way and the rotation order follows automatically.",
    "Restarting the API server drops your kubectl mid-task. Expect it, keep the file backup (/etc/kubernetes/encryption-provider.yaml.bak), and know the undo.",
    "The exact provider order semantics are worth confirming in your docs window on exam day; the safe habit is to re-read the encryption page during the exam."
  ],
  related: ["ms-secrets", "ch-api-access", "ms-secrets-external"]
},

/* ------------------------------------------------------------------ */
{
  id: "lab-16-tenancy", domain: "microservices",
  title: "Two tenants in one cluster, with nothing shared",
  difficulty: "hard", minutes: 30, timed: 18,
  scenario: "tenants alpha and beta must not read each other's Secrets, reach each other's Pods, or exhaust the cluster. Namespaces, RBAC, quotas and NetworkPolicy - all four at once.",
  needs: ["kubectl"],
  files: ["manifests/92-tenancy.yaml", "manifests/10-netpol.yaml"],
  tasks: [
    "Create the two namespaces with enforce labels and ResourceQuota plus LimitRange in each.",
    "Give each tenant a Role in its own namespace only, and prove cross-namespace access is refused.",
    "Write the cross-namespace deny policy and verify a Pod in alpha cannot reach a Pod in beta.",
    "Show a quota actually stopping a workload, and describe which quota you would set first in a real cluster."
  ],
  verify: [
    "kubectl get ns alpha beta -o custom-columns=NAME:.metadata.name,ENFORCE:.metadata.labels['pod-security\\.kubernetes\\.io/enforce']",
    "kubectl get quota,limitrange -n alpha && kubectl get quota,limitrange -n beta",
    "kubectl auth can-i list secrets --as=system:serviceaccount:alpha:default -n beta",
    "kubectl run probe-a -n alpha --rm -it --image=busybox:1.36 --restart=Never -- sh -c 'wget -qO- --timeout=3 http://beta-svc.beta.svc.cluster.local:8080/healthz || echo BLOCKED'",
    "kubectl run ten -n alpha --image=busybox:1.36 --restart=Never -- sleep 3600 && kubectl run ten2 -n alpha --image=busybox:1.36 --restart=Never -- sleep 3600 2>&1 | head -3"
  ],
  solution: [
    { cmd: "kubectl apply -f manifests/92-tenancy.yaml",
      why: "One file, four layers: namespace with enforce labels, ResourceQuota, LimitRange, and a Role plus RoleBinding scoped inside the namespace. Naming which layer stops which abuse is the graded answer." },
    { cmd: "kubectl auth can-i list secrets --as=system:serviceaccount:alpha:default -n beta && kubectl auth can-i --list --as=system:serviceaccount:alpha:default -n alpha",
      why: "RBAC is namespace-scoped by design, so a RoleBinding is the isolation. A ClusterRoleBinding for a tenant identity is the finding to hunt for, and this command pair proves both directions." },
    { cmd: "kubectl apply -f manifests/10-netpol.yaml && kubectl run probe-a -n alpha --rm -it --image=busybox:1.36 --restart=Never -- sh -c 'wget -qO- --timeout=3 http://beta-svc.beta.svc.cluster.local:8080/healthz || echo BLOCKED'",
      why: "Namespace isolation is not network isolation. The default-deny policy in the tenant namespace plus an explicit cross-namespace deny is the in-cluster answer; a CNI deny rule (Cilium) is the stronger one and worth naming." },
    { cmd: "kubectl delete pod ten ten2 -n alpha",
      why: "Quota rejections read like a controller bug: the ReplicaSet reports FailedCreate and the real reason sits in its events. kubectl describe rs ten | grep -A5 FailedCreate is the diagnosis you should already know." }
  ],
  pitfalls: [
    "ResourceQuota stops creation; LimitRange stamps defaults on Pods that omit requests. Without requests, quota accounting is weak.",
    "A tenant with the ability to create a RoleBinding can bind any ClusterRole in the cluster if it also has the escalate or bind verb - check for that combination.",
    "Namespaces are not a security boundary by themselves: they only become one when RBAC, NetworkPolicy and PSA levels are all set."
  ],
  related: ["ms-tenancy", "ch-rbac", "cs-netpol"]
},

/* ------------------------------------------------------------------ */
{
  id: "lab-17-sandbox", domain: "microservices",
  title: "RuntimeClass and a sandboxed runtime, honestly",
  difficulty: "hard", minutes: 25, timed: 12,
  scenario: "One tenant's workloads must run in a different kernel. Create the RuntimeClass, configure the container runtime handler, and know what your lab cannot demonstrate.",
  needs: ["kubectl", "docker", "a VM with gVisor or Kata installed for the full path"],
  files: ["manifests/93-runtimeclass.yaml"],
  tasks: [
    "Register a runtime handler in containerd's config on the node and restart the runtime.",
    "Create the RuntimeClass with handler, nodeName and a scheduling nodeSelector, and confirm the Pod lands on the right node.",
    "Apply the class to a workload and prove a Pod without the class is not scheduled there.",
    "State the difference between sandboxing a kernel (gVisor, Kata) and filtering syscalls (seccomp), and when each is the right answer."
  ],
  verify: [
    "kubectl get runtimeclass",
    "docker exec cks-worker sh -c 'grep -n -A6 \"runtime handler\" /etc/containerd/config.toml 2>/dev/null | head -20 || cat /etc/containerd/config.toml | head -30'",
    "kubectl run gvisor-probe -n prod --image=busybox:1.36 --restart=Never --overrides='{\"apiVersion\":\"v1\",\"spec\":{\"runtimeClassName\":\"gvisor\"}}' -- sleep 3600 && kubectl get pod gvisor-probe -o wide",
    "kubectl describe pod gvisor-probe | grep -A4 Events",
    "kubectl delete pod gvisor-probe -n prod"
  ],
  solution: [
    { cmd: "docker exec cks-worker sh -c 'printf \"\\n[plugins.\\\"io.containerd.runtime.v1.linux\\\".runtime_handlers.\\\"runsc\\\"]\\n  path = \\\"/usr/local/bin/runsc\\\"\\n\" >> /etc/containerd/config.toml' && docker restart cks-worker",
      why: "The graded half is this: a RuntimeClass handler must exist in the container runtime configuration on the node, and the runtime must be restarted for it to be known. kindest/node ships no runsc, so expect the Pod to fail to start - that failure is the lesson, not a lab bug." },
    { cmd: "kubectl apply -f manifests/93-runtimeclass.yaml && kubectl get runtimeclass gvisor -o yaml",
      why: "spec.handler is the link between the class and the runtime config string, so the two names must match exactly. nodeName pins the class to a node where you know the handler exists - the practical exam move when only some nodes are prepared." },
    { cmd: "kubectl run gvisor-probe -n prod --image=busybox:1.36 --restart=Never --overrides='{\"apiVersion\":\"v1\",\"spec\":{\"runtimeClassName\":\"gvisor\"}}' -- sleep 3600; kubectl get pod gvisor-probe -o wide; kubectl describe pod gvisor-probe | tail -12",
      why: "Read the events: no runsc binary, or no such handler is what you should see in kind, and you should be able to name the fix (install the runtime on that node, or point nodeName at a node that has it)." },
    { cmd: "# on a VM with gVisor installed: the workload Pod then starts, and the proof is a kernel that is not the host's\nkubectl exec gvisor-probe -- uname -a   # compare with the host uname",
      why: "On a real node the demonstration is the difference between the two uname outputs. That single comparison explains sandboxing better than any paragraph." }
  ],
  pitfalls: [
    "A RuntimeClass alone does nothing: without the runtime handler on the node the Pod fails to start.",
    "scheduling.nodeSelector plus the class is how you keep a sandbox-requiring workload off an unprepared node; the default handler is what Pods without a class get.",
    "gVisor is not a VM and Kata is: know which one you are naming, and what it costs in performance and in host integration."
  ],
  related: ["ms-sandbox", "ms-tenancy", "sh-seccomp"]
},

/* ------------------------------------------------------------------ */
{
  id: "lab-18-mtls", domain: "microservices",
  title: "Pod-to-Pod encryption without rewriting the application",
  difficulty: "medium", minutes: 25, timed: 12,
  scenario: "payments-api must reach its backend over mutual TLS, and the application must not change. Practise the decision: mesh sidecars, CNI-native encryption, or application-level TLS from a managed control plane.",
  needs: ["kubectl", "helm (for a mesh install)", "two terminals: one in the cluster, one in the app's traffic path"],
  files: ["manifests/94-mtls.yaml", "manifests/00-cluster-base.yaml"],
  tasks: [
    "Install a mesh control plane in its own namespace and label one app namespace for injection.",
    "Roll the workload and confirm two containers per Pod, then set peer authentication to STRICT and traffic to ISTIO_MUTUAL.",
    "Show the encryption actually happening - in the proxy's own view of its connections.",
    "Write down the alternative you would choose on a managed cluster with no room for a mesh, and why."
  ],
  verify: [
    "kubectl get ns web -o jsonpath='{.metadata.labels.istio-injection}'",
    "kubectl get pod -n web -o jsonpath='{range .items[*]}{.metadata.name}{\" containers: \"}{.spec.containers[*].name}{\"\\n\"}{end}'",
    "kubectl get peerauthentication -A && kubectl get destinationrule -A",
    "kubectl exec -it deploy/payments-api -n prod -c istio-proxy -- pilot-agent request GET clusters 2>&1 | grep -iE 'ssl|tls' | head -10"
  ],
  solution: [
    { cmd: "helm repo add istio https://istio-release.storage.googleapis.com/charts && helm install istio-base istio/base -n istio-system --create-namespace && helm install istiod istio/istiod -n istio-system --wait",
      why: "Install the control plane in its own namespace, before you label any workload. Injection is a mutating webhook on Pod creation, so existing Pods need a rollout before they get a sidecar." },
    { cmd: "kubectl label ns prod istio-injection=enabled --overwrite && kubectl rollout restart deploy/payments-api -n prod && kubectl rollout status deploy/payments-api -n prod",
      why: "rollout restart is the safe way to introduce sidecars: the Deployment keeps its replicas available while the new Pods come up with two containers." },
    { cmd: "kubectl apply -f manifests/94-mtls.yaml && kubectl get peerauthentication strict -n prod -o yaml",
      why: "PeerAuthentication STRICT plus a DestinationRule with ISTIO_MUTUAL is the pair that makes mTLS mandatory in the mesh. STRICT with a plain HTTP DestinationRule produces connection failures that look like an application bug." },
    { cmd: "kubectl exec -it deploy/payments-api -n prod -c istio-proxy -- pilot-agent request GET clusters | head -40",
      why: "The proxy's cluster list shows which upstream clusters are configured with TLS transport sockets. Reading the proxy's own configuration is how you prove encryption rather than assuming it." }
  ],
  pitfalls: [
    "A mesh adds a mutating webhook to every Pod create in the labelled namespace - that is a dependency and a failure mode, not a free win.",
    "Ingress and egress still need explicit policy: mesh mTLS is cluster-internal, not a replacement for edge TLS or a gateway.",
    "Cilium's native mTLS and a managed service mesh both exist as exam-acceptable answers; say which one you would operate and what you would give up."
  ],
  related: ["ms-mtls", "cs-ingress-tls", "ms-tenancy"]
},

/* ------------------------------------------------------------------ */
{
  id: "lab-19-pipeline", domain: "supply-chain",
  title: "Build, scan, sign, verify, deploy - one pipeline you can run twice",
  difficulty: "hard", minutes: 40, timed: 20,
  scenario: "Take a small Go service from source to a running Deployment with a provenance trail: minimal image, SBOM, gate on vulnerability severity, signature, verification at admission, and a digest-pinned Deployment.",
  needs: ["docker", "kubectl", "trivy", "cosign", "syft (or kaniko/cosign sbom subcommand)", "helm (for the Kyverno policy in step 5)"],
  files: ["supplychain/Dockerfile", "supplychain/Dockerfile.full", "supplychain/pipeline.ps1", "supplychain/pipeline.sh", "supplychain/policy/app.rego"],
  tasks: [
    "Build the distroless image and the fat variant, and put a provenance label on the distroless one.",
    "Generate the SBOM, run the scan, and make the gate fail on purpose by adding a dependency with a known high severity issue.",
    "Sign the image locally with cosign, then verify it with the exact identity you meant to trust.",
    "Deploy the image by digest with an immutable rollout, and prove a retag of the same tag cannot move the workload."
  ],
  verify: [
    "docker images --format '{{.Repository}}:{{.Tag}} {{.Size}}' | grep cks-lab",
    "trivy image --exit-code 1 --severity HIGH,CRITICAL --ignore-unfixed cks-lab/api:lab",
    "cosign verify --certificate-identity-regexp 'cks-lab@lab' --certificate-oidc-issuer 'https://github.com/login/oidc' cks-lab/api:lab 2>&1 | head -12",
    "kubectl get deploy payments-api -n prod -o jsonpath='{.spec.template.spec.containers[0].image} {.spec.template.spec.containers[0].imagePullPolicy}'",
    "kubectl get deploy payments-api -n prod -o jsonpath='{.spec.template.metadata.annotations}'"
  ],
  solution: [
    { cmd: "cd supplychain; docker build -t cks-lab/api:lab . ; docker run --rm cks-lab/api:lab /app/version.sh 2>&1 | head -4",
      why: "A container that cannot be run has nothing to do with supply chain security. Confirm the entrypoint works before you start attesting things about it - and note that a distroless image has no shell, so /app/version.sh must be a static binary or a shell from another stage copied deliberately." },
    { cmd: "syft packages dir:. -o json > sbom.json 2>/dev/null || syft cks-lab/api:lab -o json > sbom.json; trivy image --format table --severity HIGH,CRITICAL cks-lab/api:lab | head -25",
      why: "SBOM from the artifact, scan from the same artifact, both against the same digest. The value is the pairing: an SBOM tells you what you shipped, the scanner tells you what it means, and neither is useful attached to a floating tag." },
    { cmd: "cosign sign --yes cks-lab/api@sha256:REPLACE_WITH_THE_BUILD_DIGEST",
      why: "Sign by digest, never by tag, and say why out loud: a signature attached to a tag protects whatever the tag pointed at when you signed. Get the digest from docker inspect --format '{{index .RepoDigests 0}}' after a push, or from .Id after a local build." },
    { cmd: "cosign verify --certificate-identity-regexp 'cks-lab@lab' --certificate-oidc-issuer 'https://github.com/login/oidc' cks-lab/api:lab | jq '.[].critical.image.signature' | head -3",
      why: "Verification is only as strong as the issuer and identity you assert. Verify with a deliberately wrong identity once and watch it still return a valid cryptographic result - that is the moment the requirement to pin identity stops being abstract." },
    { cmd: "kubectl apply -f manifests/95-hardened.yaml && kubectl rollout history deploy/hardened-api -n prod",
      why: "Immutable settings (imagePullPolicy IfNotPresent, readOnlyRootFilesystem, drop ALL, allowPrivilegeEscalation false, non-zero runAsUser) plus a digest reference make one release auditable and reproducible. rollout history plus the annotations is the trail you would show an auditor." }
  ],
  pitfalls: [
    "A local cosign key lives in your shell's working directory: a signature made with one key is unverifiable by anyone who does not have the public key, which is exactly why keyless identity is the default plan.",
    "The gate must stop the pipeline. trivy --exit-code 1 is the whole trick; a report nobody blocks on is documentation, not control.",
    "A digest-pinned Deployment with imagePullPolicy Always re-pulls from a registry you may no longer trust - IfNotPresent with a digest is the combination to defend."
  ],
  related: ["sc-base-image", "sc-supply", "sc-sign", "sc-static-analysis", "sc-registries"]
},

/* ------------------------------------------------------------------ */
{
  id: "lab-20-registry-trust", domain: "supply-chain",
  title: "Only approved registries, and a cluster that can actually pull them",
  difficulty: "medium", minutes: 25, timed: 15,
  scenario: "Private registry, pull credentials on the right ServiceAccount, and an admission policy that refuses images from anywhere else. Test both halves: the pull must work and the unapproved image must not.",
  needs: ["kubectl", "a registry you can reach (a local registry container is enough for the lab)"],
  files: ["manifests/96-imagepolicy.yaml", "manifests/00-cluster-base.yaml"],
  tasks: [
    "Create the registry Secret and attach it to the namespace default ServiceAccount, then prove a Pod in that namespace pulls without a manifest change.",
    "Write the approved-registry list as imagePatterns with wildcards and confirm a violating Pod is rejected.",
    "Test the wildcard boundaries on purpose: a sub-registry, a lookalike domain, and a port variant.",
    "Explain why mutating the ServiceAccount is the right place for pull credentials."
  ],
  verify: [
    "kubectl get secret regcred -n prod -o jsonpath='{.type} {.data.\\.dockerconfigjson}'",
    "kubectl get serviceaccount default -n prod -o jsonpath='{.imagePullSecrets}'",
    "kubectl run from-approved -n prod --image=registry.internal.local/app/api:lab --restart=Never -- sleep 60 2>&1 | head -3",
    "kubectl run from-elsewhere -n prod --image=docker.io/library/nginx:1.27 --restart=Never -- sleep 60 2>&1 | head -3",
    "kubectl get validatingadmissionpolicy,validatingadmissionpolicybinding -A"
  ],
  solution: [
    { cmd: "kubectl create secret docker-registry regcred -n prod --docker-server=registry.internal.local --docker-username=ci --docker-password=REPLACE --docker-email=ci@example.internal && kubectl patch serviceaccount default -n prod -p '{\"imagePullSecrets\":[{\"name\":\"regcred\"}]}'",
      why: "Patching the default ServiceAccount means every Pod in the namespace inherits the credential, and no workload manifest has to carry a secret name. Attaching it per-Pod is the pattern that leaks when someone copies a manifest." },
    { cmd: "kubectl apply -f manifests/96-imagepolicy.yaml && kubectl run from-elsewhere -n prod --image=docker.io/library/nginx:1.27 --restart=Never -- sleep 60",
      why: "The rejection is the point, and so is the wildcard semantics: registry.internal.local/** matches sub-paths but does not match registry.internal.local.evil.example. Write the boundary test before you call the policy done." },
    { cmd: "kubectl explain validatingadmissionpolicy.spec.validationConditions --recursive 2>&1 | head -30",
      why: "ValidatingAdmissionPolicy is CEL-based, so the expression is the policy. Reading the schema on the cluster is faster than remembering whether a field is celExpression or expression, and it is available in the exam." },
    { cmd: "kubectl logs deploy/kyverno-admission-controller -n kyverno --tail=30 2>/dev/null | grep -i verifyimages | head; kubectl get events -n prod --sort-by=.lastTimestamp | tail -10",
      why: "Whatever enforcement you choose, the evidence that it fired lives in the webhook log and in namespace events. A policy that silently matched nothing is the failure mode to catch early." }
  ],
  pitfalls: [
    "imagePullSecrets on a ServiceAccount is namespace-scoped: a workload running with a different ServiceAccount in the same namespace gets nothing.",
    "ValidatingAdmissionPolicy graduation and field names move between versions - confirm with kubectl explain rather than a remembered snippet.",
    "A Secret in a namespace is readable by anyone with get on secrets there; registry credentials are Secret data, which is why encryption at rest and RBAC for secrets belong to the same task."
  ],
  related: ["sc-registries", "sc-sign", "ch-rbac", "ms-secrets"]
},

/* ------------------------------------------------------------------ */
{
  id: "lab-21-falco", domain: "runtime-security",
  title: "Falco: install, write a rule, trigger it on purpose, then quiet it down",
  difficulty: "hard", minutes: 35, timed: 18,
  scenario: "A shell appearing inside an application container is the event you must catch. Install Falco, write a rule for it, make it fire, then tune until the output is worth reading.",
  needs: ["kubectl", "helm", "a kernel that supports Falco's modern eBPF driver (Docker Desktop on WSL2 may not: fall back to a Linux VM)"],
  files: ["falco-values.yaml"],
  tasks: [
    "Install Falco as a DaemonSet with the modern eBPF driver and the Kubernetes metadata collector enabled.",
    "Write a custom rule with the output carrying Pod, namespace, image and the command line, and append it rather than replacing the default rules.",
    "Trigger it: exec a shell into the app container and read the alert with its Kubernetes fields filled in.",
    "Tune with one condition and one priority change, then verify the noise changed and the coverage did not."
  ],
  verify: [
    "kubectl get ds -n falco && kubectl get pods -n falco -o wide",
    "kubectl logs -n falco -l app.kubernetes.io/name=falco --tail=40 | grep -iE 'driver|rules loaded|kubernetes'",
    "kubectl exec -it hardened-api -n prod -- sh -c 'whoami; cat /etc/passwd | head -3' && sleep 3 && kubectl logs -n falco -l app.kubernetes.io/name=falco --tail=20 | grep -i shell",
    "kubectl exec -n falco ds/falco -- falco --validate /etc/falco/falco_rules.local.yaml 2>&1 | tail -5",
    "kubectl logs -n falco -l app.kubernetes.io/name=falco --tail=100 | jq -c 'select(.rule) | {rule, priority, k8s: {ns: .k8s.ns.name, pod: .k8s.pod.name}, cmd: .proc.cmdline}' 2>/dev/null | head -8"
  ],
  solution: [
    { cmd: "helm repo add falcosecurity https://falcosecurity.github.io/charts && helm repo update && helm install falco falcosecurity/falco -n falco --create-namespace -f falco-values.yaml --wait",
      why: "The values.yaml described here turns on the modern eBPF driver, the Kubernetes collector and JSON output, and appends a custom rule through custom_rules. Install into its own namespace so Falco's own Pods are not policed by PSA levels meant for applications." },
    { cmd: "kubectl exec -n falco ds/falco -- sh -c 'falco --version; falco --validate /etc/falco/falco_rules.local.yaml' 2>&1 | tail -8",
      why: "Validate the rule file before you rely on the alert. A YAML that Falco rejects leaves you with a DaemonSet that is Ready and a rule that never existed - the worst kind of false confidence." },
    { cmd: "kubectl exec -it hardened-api -n prod -- sh -c 'whoami; id'  # then immediately read the falco pod log",
      why: "Trigger the rule yourself. An alert whose output contains the Pod name, namespace, image repository and the actual command line is a usable alert; one that says 'shell inside a container' without attribution is something you will ignore at 3am." },
    { cmd: "# append a condition that excludes your own tooling, then move the noisy rule to a lower priority\nhelm upgrade falco falcosecurity/falco -n falco -f falco-values.yaml --reuse-values --set custom_rules[1].append=true",
      why: "Tuning is subtractive: exclude the images and processes you know are legitimate, keep the coverage of the ones you do not, and use priority to decide what reaches a human. Test the tuned rule by triggering the incident again - both the false positive gone and the true positive still firing." }
  ],
  pitfalls: [
    "Falco's kernel driver support depends on the host: modern eBPF works on kernels 5.8 and newer, and on WSL2 or Docker Desktop you may need a VM. The site labels this lab as VM-dependent on purpose.",
    "Overriding a stock rule is done by name in falco_rules.local.yaml (append) rather than editing falco_rules.yaml, which helm and upgrades will replace.",
    "Falco alerts are only as good as your response runbook. Write the alert-to-action line before you install anything."
  ],
  related: ["rt-falco", "rt-detect", "rt-ir"]
},

/* ------------------------------------------------------------------ */
{
  id: "lab-22-audit", domain: "runtime-security",
  title: "The audit log answers the question nobody asked yet",
  difficulty: "hard", minutes: 30, timed: 15,
  scenario: "After an incident you need to know who did what and when, from the audit log alone. Set the policy, generate a realistic sequence of events, and write the queries that answer the questions.",
  needs: ["kubectl", "docker", "jq"],
  files: ["audit-policy.yaml"],
  tasks: [
    "Read the audit policy you wrote for this lab and say which events are recorded at which level, in the order the first matching rule wins.",
    "Generate the incident: a token created, Pods listed, an exec into a Pod, a Secret read, then a Deployment scaled to zero.",
    "Query it: who, from which source IP, with which User-Agent, against which resource and subresource.",
    "Show the query that would catch the exfil pattern: many Secrets read by one identity in a short window."
  ],
  verify: [
    "docker exec cks-control-plane sh -c 'wc -l /var/log/kubernetes/audit.log; tail -1 /var/log/kubernetes/audit.log | jq -c \"{user: .user.username, ip: .sourceIPs, verb: .verb, resource: .objectRef.resource, subresource: .objectRef.subresource, ua: .requestURI}\"'",
    "kubectl create token ci-sa -n app --duration=600s > /dev/null; kubectl get secrets -n prod > /dev/null; kubectl exec -it hardened-api -n prod -- true 2>/dev/null; kubectl scale deploy payments-api -n prod --replicas=0 && kubectl scale deploy payments-api -n prod --replicas=1",
    "docker exec cks-control-plane sh -c 'tail -200 /var/log/kubernetes/audit.log' | jq -c 'select(.objectRef.resource==\"secrets\") | {t: .requestReceivedTimestamp, u: .user.username, v: .verb, o: .objectRef.name}'",
    "docker exec cks-control-plane sh -c 'tail -500 /var/log/kubernetes/audit.log' | jq -r 'select(.verb==\"get\" and .objectRef.resource==\"secrets\") | .user.username' | sort | uniq -c | sort -rn | head -5",
    "docker exec cks-control-plane sh -c 'tail -500 /var/log/kubernetes/audit.log' | jq -c 'select(.objectRef.subresource==\"exec\") | {u: .user.username, o: .objectRef.name, uri: .requestURI, code: .responseCode}'"
  ],
  solution: [
    { cmd: "docker exec cks-control-plane cat /etc/kubernetes/audit-policy.yaml",
      why: "Levels are RequestResponse, Request, Metadata and None, and the first matching rule wins - so specific rules go first and the catch-all last. That single ordering fact is what makes the difference between a usable log and a 2 GB one." },
    { cmd: "docker exec cks-control-plane sh -c 'tail -500 /var/log/kubernetes/audit.log' | jq -c 'select(.verb==\"exec\" or .objectRef.subresource==\"exec\") | {u: .user.username, g: .user.groups, ip: .sourceIPs, ua: .userAgent, o: .objectRef.name, uri: .requestURI, code: .responseCode}'",
      why: "Attribution is the whole answer: user name, groups, sourceIPs, userAgent and the objectRef. An exec you cannot attribute to a subject is not evidence." },
    { cmd: "docker exec cks-control-plane sh -c 'tail -2000 /var/log/kubernetes/audit.log' | jq -r '[.requestReceivedTimestamp, .user.username, .verb, .objectRef.resource, .objectRef.name, .responseCode] | @tsv' | tail -30",
      why: "This is the one-liner you write from memory under time pressure. Practise it until the jq shape is automatic; on the exam the thinking time is the expensive part, not the typing." },
    { cmd: "docker exec cks-control-plane sh -c 'tail -2000 /var/log/kubernetes/audit.log' | jq -r 'select(.objectRef.resource==\"secrets\") | [.user.username, .verb] | @tsv' | sort | uniq -c | sort -rn | head -10",
      why: "Volume by identity is the exfil detector: one subject reading dozens of Secrets in minutes is the pattern. Say the follow-up you would run - which Secret, from where, and what you would contain first." }
  ],
  pitfalls: [
    "level: None on a catch-all silences everything after it; a policy that only records Metadata loses the payload you needed for the investigation.",
    "node-level events (system:node users) dominate the log. Filter them out in your queries or your signal disappears.",
    "In kind the log lives inside the control-plane container at /var/log/kubernetes/audit.log; on the exam node it is usually /var/log/kubernetes/audit.log or the path your --audit-log-path names. Read the flag before you grep a path."
  ],
  related: ["rt-audit", "rt-ir", "ch-api-access"]
},

/* ------------------------------------------------------------------ */
{
  id: "lab-23-incident", domain: "runtime-security",
  title: "Containment drill: a live mining workload, twelve minutes",
  difficulty: "hard", minutes: 30, timed: 12,
  scenario: "payments-api has been replaced by something that is talking outbound and writing to the node. Contain it without destroying the evidence you will need afterwards - on the clock.",
  needs: ["kubectl", "docker"],
  files: ["manifests/30-bad-pod.yaml", "manifests/50-containment-netpol.yaml", "manifests/95-hardened.yaml"],
  tasks: [
    "Find what is running and what it is doing: image, command, mount, network, and who created it.",
    "Contain first with a NetworkPolicy, then scale the workload down - in that order - and record why that order.",
    "Pull the forensic evidence: process information from the container runtime on the node, and the audit events that created the workload.",
    "Write the three lines of your after-incident report: containment, evidence, and the control that would have prevented it."
  ],
  verify: [
    "kubectl get pods -A -o wide | grep -vE 'kube-system|Running *1/1' | head",
    "kubectl get pod,deploy,rs -n prod -o json | jq -r '.items[] | select(.kind==\"Pod\") | [.metadata.name, .spec.containers[0].image, .metadata.creationTimestamp] | @tsv'",
    "kubectl get events -A --sort-by=.lastTimestamp | tail -20",
    "docker exec cks-worker sh -c 'crictl ps; crictl pods' 2>/dev/null | head -12",
    "kubectl run netpol-block -n prod --rm -it --image=busybox:1.36 --restart=Never -- sh -c 'wget -qO- --timeout=3 http://payments-api.prod.svc.cluster.local:8080/healthz || echo BLOCKED'"
  ],
  solution: [
    { cmd: "kubectl get pods -n prod -o jsonpath='{range .items[*]}{.metadata.name}{\" \"}{.spec.containers[*].image}{\" \"}{.spec.containers[*].command}{\"\\n\"}{end}'",
      why: "Start by reading what is actually there. The image and command tell you more in one line than any dashboard, and creationTimestamp plus the events timeline tells you when it arrived." },
    { cmd: "kubectl apply -f manifests/50-containment-netpol.yaml && kubectl scale deploy payments-api -n prod --replicas=0",
      why: "NetworkPolicy first, scale second: cutting the network stops the beaconing and the lateral movement while the workload is still intact enough to inspect. Scale first and you have deleted your own evidence, and a Deployment delete re-creates nothing you can look at." },
    { cmd: "docker exec cks-worker sh -c 'crictl ps -a; crictl inspect <CONTAINER_ID> | head -60' 2>/dev/null; docker exec cks-worker sh -c 'ls -la /var/lib/kubelet/pods | head'",
      why: "Runtime-level facts are the ones nobody can forge: image ID, created time, mounts, environment. On the exam node this is crictl over the node's socket, and kubectl debug node/<node> -- chroot /host <cmd> is how you reach it when you only have kubectl." },
    { cmd: "docker exec cks-control-plane sh -c 'tail -1000 /var/log/kubernetes/audit.log' | jq -c 'select(.verb==\"create\" and (.objectRef.resource==\"pods\" or .objectRef.resource==\"deployments\")) | {t: .requestReceivedTimestamp, u: .user.username, ip: .sourceIPs, ua: .userAgent, o: .objectRef.name}'",
      why: "Who created it, from which IP, with which client - that is the entry point. Answer with the audit record, not with a guess, and then name the control that would have stopped it: PSA enforce, a policy on hostPath, RBAC that did not allow create in that namespace, or a default-deny egress that was already in place." },
    { cmd: "kubectl delete pod bad-privileged bad-root hostpath-probe -n prod 2>/dev/null; kubectl delete -f manifests/30-bad-pod.yaml 2>/dev/null; kubectl rollout restart deploy/payments-api -n prod",
      why: "Rebuild from a known-good image rather than cleaning a compromised one, and say that in the report. Patching the node is a separate step from replacing the workload, and conflating them is how an incident stays open." }
  ],
  pitfalls: [
    "Deleting the Pod is the fastest thing to do and the worst thing to do first. Scale, then preserve, then remove.",
    "Evidence in the container runtime disappears when the container is removed, so capture crictl output before any delete.",
    "A containment NetworkPolicy that also blocks your own debugging path leaves you unable to reach the Pod you are investigating - plan the allow rule for your debug identity."
  ],
  related: ["rt-ir", "rt-detect", "rt-audit", "cs-netpol"]
}
];
