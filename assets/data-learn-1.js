/*
 * CKS Prep - study content, part 1.
 * Domains: Cluster Setup (15%), Cluster Hardening (15%), System Hardening (10%).
 * Content is exam-oriented: what to type, which file to edit, how to verify.
 */
window.CKS_LEARN = window.CKS_LEARN || [];

window.CKS_LEARN.push(

/* ------------------------------------------------------------------ Cluster Setup */

{
  id: "cs-netpol",
  domain: "cluster-setup",
  title: "NetworkPolicies to restrict cluster-level access",
  tags: ["networkpolicy", "deny-all", "egress", "dns"],
  summary:
    "A default-deny policy plus explicit allow rules is the cluster-level guardrail. CKS tasks usually ask you to stop a Pod from talking to the API server, to another namespace, or to a node metadata endpoint - while keeping DNS working.",
  notes: [
    "NetworkPolicy is a namespaced object; a Pod is isolated for a direction as soon as any policy selects it for that direction (ingress or egress). Unselected Pods stay unrestricted.",
    "Always test the direction you were asked about. policyTypes: [Ingress] alone does nothing for egress traffic, and vice versa.",
    "Egress to DNS must be allowed explicitly or cluster-wide DNS breaks: allow UDP 53 (and TCP 53) to the kube-dns/CoreDNS Pod, usually matched with namespaceSelector: {kubernetes.io/metadata.name: kube-system} plus podSelector on the CoreDNS labels.",
    "podSelector with no namespaceSelector means 'Pods in the same namespace as the policy'. namespaceSelector alone means 'all Pods in matching namespaces'. Combining both in one 'from' entry means AND (same namespace AND matching labels). Use two separate 'from' entries for OR.",
    "ipBlock works for external IPs only (not cluster-internal Pod IPs) - use it for blocking/allowing metadata endpoints and external services: 0.0.0.0/0 except 169.254.169.254/32, 10.0.0.0/8, 192.168.0.0/16, 172.16.0.0/12.",
    "To protect the control plane at cluster level, CNI-level policy (Cilium, Calico global network policy, or a firewall on the nodes) is what blocks access to node ports such as 10250, 2379-2380."
  ],
  commands: [
    { cmd: "kubectl get networkpolicy -A", why: "List existing isolation; check whether the target Pod is already selected." },
    { cmd: "kubectl describe networkpolicy deny-all -n prod", why: "Confirm policyTypes and selectors - most debugging is reading selectors." },
    { cmd: "kubectl run probe --rm -it --image=busybox:1.36 --restart=Never -- sh", why: "Drop a probe Pod into the namespace you just isolated, then test from inside it." },
    { cmd: "nslookup kubernetes.default.svc.cluster.local ; wget -qO- --timeout=3 http://api.prod.svc.cluster.local:8080/healthz", why: "Inside the probe Pod: DNS must still work and the blocked target must time out. This is the check the grader runs." },
    { cmd: "kubectl apply --dry-run=server -f netpol.yaml", why: "Validate the manifest against the real API server before you rely on it." }
  ],
  yaml: [
    {
      title: "Default deny all ingress and egress in a namespace",
      body: `apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny-all
  namespace: prod
spec:
  podSelector: {}
  policyTypes:
  - Ingress
  - Egress`
    },
    {
      title: "Deny egress except DNS + one backend",
      body: `apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: app-egress
  namespace: prod
spec:
  podSelector:
    matchLabels:
      app: api
  policyTypes:
  - Egress
  egress:
  - to:
    - namespaceSelector:
        matchLabels:
          kubernetes.io/metadata.name: kube-system
      podSelector:
        matchLabels:
          k8s-app: kube-dns
    ports:
    - protocol: UDP
      port: 53
    - protocol: TCP
      port: 53
  - to:
    - podSelector:
        matchLabels:
          app: database
    ports:
    - protocol: TCP
      port: 5432`
    },
    {
      title: "Block access to the cloud metadata endpoint (and private ranges) from a Pod",
      body: `apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: no-metadata-egress
  namespace: prod
spec:
  podSelector:
    matchLabels:
      app: api
  policyTypes:
  - Egress
  egress:
  - to:
    - ipBlock:
        cidr: 0.0.0.0/0
        except:
        - 169.254.169.254/32
        - 10.0.0.0/8
        - 192.168.0.0/16
        - 172.16.0.0/12
    ports:
    - protocol: TCP
      port: 443`
    }
  ],
  gotchas: [
    "Calico, Cilium and CNI-less clusters differ: kind with default CNI supports NetworkPolicy; a cluster with 'none' CNI silently ignores every policy. Prove enforcement with a real connection test, not with kubectl get.",
    "A deny-all egress in kube-system or in a namespace holding your ingress controller breaks the cluster - scope policies to application Pods.",
    "NetworkPolicy cannot match by Pod annotations or by image; only labels, namespaces, IP blocks and ports/protocols."
  ],
  docs: [
    { label: "Network Policies reference + recipes", url: "https://kubernetes.io/docs/concepts/services-networking/network-policies/" },
    { label: "Administering Network Policies (Cilium/Calico)", url: "https://kubernetes.io/docs/concepts/extend-kubernetes/compute-storage-net/network-plugins/" }
  ]
},

{
  id: "cs-cis",
  domain: "cluster-setup",
  title: "CIS benchmark: audit the control plane and kubelet",
  tags: ["kube-bench", "cis", "api-server", "etcd", "kubelet"],
  summary:
    "You must be able to run kube-bench, read its output, locate the offending flag in the manifest or kubelet config, change it, and re-run to show the FAIL is gone.",
  notes: [
    "In a kubeadm cluster the control plane runs as static Pods: edit /etc/kubernetes/manifests/kube-apiserver.yaml (etcd.yaml, kube-scheduler.yaml, kube-controller-manager.yaml) and add or change flags in the containers[].command list. kubelet restarts the Pod when the file changes.",
    "For a managed cluster or a kind node, the same file lives inside the control-plane node: docker exec -it <node> sh -c 'vi /etc/kubernetes/manifests/kube-apiserver.yaml'.",
    "The kubelet is configured by /var/lib/kubelet/config.yaml (dynamic config) plus its command line; CIS kubelet checks are run on each node with 'kube-bench node'.",
    "High-value API server fixes: anonymous-auth=false, authorization-mode=Node,RBAC, client-ca-file set, enable-admission-plugins includes NodeRestriction, audit-log-path + audit-policy-file set, event-ttl bounded, profiling=false, kubelet-certificate-authority set.",
    "etcd fixes: client-cert-auth=true, peer-client-cert-auth=true, trusted-ca-file set, auto-tls=false, no anonymous/HTTP access to 2379.",
    "kubelet fixes: anonymousAuth=false, authorize/authorization mode Webhook or Node,Webhook, readOnlyPort=0, protectKernelDefaults=true, streamingConnectionIdleTimeout set (4m), makeIPTablesUtilChains=false, client-ca-file present, cert/key files present with 644 on the config file.",
    "kube-bench reports 'WARN' when it cannot determine the state - a WARN is your cue to look at the flag yourself."
  ],
  commands: [
    { cmd: "docker run --rm --pid=host --net=host -v /etc:/etc:ro -v /var:/var:ro -v /usr:/usr:ro -v /proc:/host/proc:ro -v /lib/modules:/lib/modules:ro aquasec/kube-bench:latest master --no-color", why: "Run master (control plane) checks with host PID namespace so kube-bench can read the static Pod manifests." },
    { cmd: "docker run --rm --pid=host --net=host -v /etc:/etc:ro -v /var:/var:ro aquasec/kube-bench:latest node --no-color", why: "Run the worker/kubelet CIS checks on the node you are executing on." },
    { cmd: "kube-bench master --check 1.2 --noremediations --no-color", why: "Limit the run to one control group - fast when a task names a specific control." },
    { cmd: "kube-bench run --targets master,node --summary", why: "One-line summary: how many PASS/WARN/FAIL per section." },
    { cmd: "kubectl get pods -n kube-system -o yaml | grep -A3 'command:'", why: "When the control plane is a Pod (some distros), read the real flags from the Pod spec instead of the manifest file." }
  ],
  yaml: [
    {
      title: "kube-apiserver static Pod: hardened flags (excerpt)",
      body: `apiVersion: v1
kind: Pod
metadata: { name: kube-apiserver, namespace: kube-system }
spec:
  containers:
  - name: kube-apiserver
    command:
    - kube-apiserver
    - --allow-privileged=true
    - --anonymous-auth=false
    - --authorization-mode=Node,RBAC
    - --client-ca-file=/etc/kubernetes/pki/ca.crt
    - --enable-admission-plugins=NodeRestriction,PodSecurity
    - --audit-policy-file=/etc/kubernetes/policy/audit-policy.yaml
    - --audit-log-path=/var/log/kubernetes/audit.log
    - --audit-log-maxage=30
    - --audit-log-maxbackup=10
    - --audit-log-maxsize=100
    - --event-ttl=2h
    - --profiling=false
    - --kubelet-certificate-authority=/etc/kubernetes/pki/ca.crt
    - --kubelet-client-certificate=/etc/kubernetes/pki/apiserver-kubelet-client.crt
    - --kubelet-client-key=/etc/kubernetes/pki/apiserver-kubelet-client.key
    - --kubelet-preferred-address-types=InternalIP,ExternalIP,Hostname
    - --service-account-lookup=true
    - --encryption-provider-config=/etc/kubernetes/encryption/encryption-config.yaml
    - --tls-cert-file=/etc/kubernetes/pki/apiserver.crt
    - --tls-private-key-file=/etc/kubernetes/pki/apiserver.key
    volumeMounts:
    - name: audit
      mountPath: /var/log/kubernetes
    - name: policy
      mountPath: /etc/kubernetes/policy
  volumes:
  - name: audit
    hostPath: { path: /var/log/kubernetes, type: DirectoryOrCreate }
  - name: policy
    hostPath: { path: /etc/kubernetes/policy, type: DirectoryOrCreate }`
    },
    {
      title: "/var/lib/kubelet/config.yaml: hardened kubelet (excerpt)",
      body: `kind: KubeletConfiguration
apiVersion: kubelet.config.k8s.io/v1beta1
address: "0.0.0.0"
port: 10250
readOnlyPort: 0
anonymousAuth: false
authentication:
  anonymous: { enabled: false }
  webhook: { enabled: true }
authorization:
  mode: Webhook
protectKernelDefaults: true
makeIPTablesUtilChains: false
streamingConnectionIdleTimeout: 4m
eventRecordQPS: 5
tlsCertFile: "/var/lib/kubelet/kubelet.crt"
tlsPrivateKeyFile: "/var/lib/kubelet/kubelet.key"
rotateCertificates: true
clientCAFile: "/etc/kubernetes/pki/ca.crt"`
    }
  ],
  gotchas: [
    "In kind, run kube-bench from inside the control-plane container (kind exec kind-control-plane ...) or use the Job from the kube-bench repo; the container needs host paths mounted to read /etc/kubernetes/manifests.",
    "Changing a static Pod manifest while the file is mounted read-only from the host means editing the host file - not the running container.",
    "kube-bench versions are version-specific: pick the image tag matching your cluster minor version, otherwise you get WARNs for flags that no longer exist."
  ],
  docs: [
    { label: "kube-bench repo (job manifests, CIS config files)", url: "https://github.com/aquasecurity/kube-bench" },
    { label: "CIS Kubernetes Benchmark overview", url: "https://www.cisecurity.org/benchmark/kubernetes" }
  ]
},

{
  id: "cs-ingress-tls",
  domain: "cluster-setup",
  title: "Ingress with TLS done properly",
  tags: ["ingress", "tls", "cert", "https"],
  summary:
    "Know how to create the TLS secret, reference it from the Ingress, keep HTTP redirecting to HTTPS, and prove the certificate serves the right hostname.",
  notes: [
    "An Ingress 'tls' block only works if a Secret of type kubernetes.io/tls with tls.crt + tls.key exists in the same namespace as the Ingress (or is created by cert-manager for you).",
    "Create the secret from files: kubectl create secret tls <name> --cert=tls.crt --key=tls.key. Create a self-signed cert with openssl in one line when the task does not give you a CA.",
    "The hosts/CN/SAN must match the hostname your client uses; a mismatch is the most common reason a TLS task scores zero.",
    "Set spec.rules[].http.paths with pathType (Prefix/Exact/ImplementationSpecific) - Ingress v1 (networking.k8s.io/v1) requires serviceName + servicePort as a numeric port, not a name.",
    "cert-manager with an Issuer/ClusterIssuer (self-signed, CA, HTTP01/DNS01) is the modern pattern: the Ingress annotation cert-manager.io/cluster-issuer does the issuance and creates the Secret.",
    "Enforce HTTPS at the controller level (ingress-nginx annotation for ssl-redirect) or at the app level; the exam may ask for a 308 redirect."
  ],
  commands: [
    { cmd: "openssl req -x509 -nodes -days 365 -newkey rsa:2048 -keyout tls.key -out tls.crt -subj '/CN=app.example.com' -addext 'subjectAltName=DNS:app.example.com'", why: "One-line self-signed certificate for a lab or an emergency exam task." },
    { cmd: "kubectl create secret tls app-tls --cert=tls.crt --key=tls.key -n prod", why: "The canonical way to create an Ingress TLS secret." },
    { cmd: "kubectl get secret app-tls -n prod -o jsonpath='{.type}{\"\\n\"}{.data.tls\\.crt}' | head -c 60", why: "Prove the Secret exists, has the right type, and carries certificate data." },
    { cmd: "kubectl describe ingress app-ingress -n prod", why: "Check hosts, TLS secret name, backend service and port are wired up." },
    { cmd: "curl -vk https://app.example.com --resolve app.example.com:443:127.0.0.1", why: "Verify the served certificate and its CN/SAN from the client side." },
    { cmd: "kubectl logs -n ingress-nginx deploy/ingress-nginx-controller | tail -n 30", why: "Controller logs show certificate load errors and misconfigured backends." }
  ],
  yaml: [
    {
      title: "Ingress v1 with TLS and HTTP backend",
      body: `apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: app-ingress
  namespace: prod
  annotations:
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
    nginx.ingress.kubernetes.io/backend-protocol: "HTTP"
spec:
  ingressClassName: nginx
  tls:
  - hosts:
    - app.example.com
    secretName: app-tls
  rules:
  - host: app.example.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: api
            port:
              number: 8080`
    },
    {
      title: "cert-manager self-signed Issuer + certificate",
      body: `apiVersion: cert-manager.io/v1
kind: Issuer
metadata: { name: selfsigned-issuer, namespace: prod }
spec:
  selfSigned: {}
---
apiVersion: cert-manager.io/v1
kind: Certificate
metadata: { name: app-cert, namespace: prod }
spec:
  secretName: app-tls
  dnsNames: ["app.example.com"]
  issuerRef: { name: selfsigned-issuer, kind: Issuer }`
    }
  ],
  gotchas: [
    "Networking Ingress v1 uses an integer service port. Port names are only valid on Services, not in Ingress backends.",
    "The Ingress controller needs a published Service (LoadBalancer/NodePort/hostNetwork). In kind, expose 443 via extraPortMappings - write this into your lab harness so you can practise TLS end to end.",
    "A TLS Secret missing tls.crt/tls.key (for example created with 'kubectl create secret generic') makes the controller serve the default fake certificate."
  ],
  docs: [
    { label: "Ingress reference (TLS section)", url: "https://kubernetes.io/docs/concepts/services-networking/ingress/" },
    { label: "cert-manager issuers", url: "https://cert-manager.io/docs/configuration/selfsigned/" }
  ]
},

{
  id: "cs-node-metadata",
  domain: "cluster-setup",
  title: "Protect node metadata and endpoints",
  tags: ["metadata", "169.254.169.254", "kubelet", "node-ports"],
  summary:
    "Two different problems: keep Pods away from the cloud/provider metadata API, and keep the outside world away from node service ports (kubelet 10250, kube-proxy healthz 10256, controller-manager 10257, scheduler 10259, etcd 2379/2380).",
  notes: [
    "Pods with hostNetwork: true can reach 169.254.169.254 directly. Removing hostNetwork is the first fix; egress NetworkPolicy (ipBlock with 169.254.169.254/32 in 'except') or a service mesh/Cilium deny rule is the enforcement layer.",
    "Node metadata protection on the node itself: kubelet --anonymous-auth=false, --read-only-port=0 (10255 disabled), authorization-mode=Webhook so the API server must authorise every kubelet request, and the kubelet listening only on the internal interface.",
    "Cloud-side: security groups / nftables allow 10250 only from cluster nodes and the control plane; never expose 2379 publicly.",
    "Node objects themselves are readable metadata (addresses, labels, images, conditions). RBAC on nodes/secrets gets you the least-privilege answer: users rarely need get nodes; serviceAccounts should not get list nodes cluster-wide.",
    "Access to kubelet via the API server proxy is granted by the Node Proxy RBAC verbs (get nodes/proxy); revoke it if a task says 'stop users from exec-ing through the API server'."
  ],
  commands: [
    { cmd: "kubectl get nodes -o wide", why: "See which addresses are exposed publicly on each node." },
    { cmd: "kubectl get --raw \"/api/v1/nodes/$(hostname -s)/proxy/healthz\"", why: "Prove the API server can proxy to the kubelet - then revoke the RBAC and prove it fails." },
    { cmd: "kubectl auth can-i get nodes/proxy --as=system:serviceaccount:prod:api-sa", why: "Check whether a service account may reach the kubelet proxy endpoint." },
    { cmd: "ss -tlnp | grep -E '10250|10255|10256|10257|2379|2380'", why: "Which node ports are actually listening and on which address (0.0.0.0 is the finding)." },
    { cmd: "curl -sk https://127.0.0.1:10250/pods | head -c 200", why: "Unauthenticated kubelet read: 401/403 means protected; a Pod list means the anonymous auth/read-only port is still open." }
  ],
  yaml: [
    {
      title: "Egress policy that blocks the metadata endpoint",
      body: `apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: deny-metadata-endpoint
  namespace: prod
spec:
  podSelector: {}
  policyTypes: [Egress]
  egress:
  - to:
    - ipBlock:
        cidr: 0.0.0.0/0
        except: [169.254.169.254/32, 10.0.0.0/8]
  - to:
    - namespaceSelector:
        matchLabels: { kubernetes.io/metadata.name: kube-system }
      podSelector: { matchLabels: { k8s-app: kube-dns } }
    ports: [{ protocol: UDP, port: 53 }]`
    }
  ],
  gotchas: [
    "NetworkPolicy ipBlock 'except' needs a CIDR bigger than the exception; a bare 169.254.169.254/32 in 'to' is also valid but blocks only that exact IP.",
    "Cilium policies can block a hostname/FQDN, NetworkPolicy cannot - if a task mentions an external API hostname, think Cilium DNS policy.",
    "10255 (read-only port) is plain HTTP with no auth; CIS calls out read-only-port=0 hard."
  ],
  docs: [
    { label: "Kubelet TLS bootstrap + authentication/authorisation", url: "https://kubernetes.io/docs/reference/configs/kubelet/" },
    { label: "RBAC Node Proxy verbs", url: "https://kubernetes.io/docs/reference/access-authn-authz/authorization/" }
  ]
},

{
  id: "cs-binary-verify",
  domain: "cluster-setup",
  title: "Verify platform binaries before deploying",
  tags: ["supply-chain", "checksum", "sha256", "kubeadm"],
  summary:
    "Prove the binaries/images you are about to install are the released ones: check hashes against the published checksum, and verify signed release images.",
  notes: [
    "Kubernetes releases publish a SHA256SUMS file with the binaries (kubeadm, kubelet, kubectl). Download it, run sha256sum -c, and only then install. This is a classic CKS 'verify platform binaries' task.",
    "Release artifacts live at https://dl.k8s.io and the release page on GitHub; binaries on the node live in /usr/bin (kubelet, kubeadm, kubectl) - know where to look and how to get the version that is running.",
    "Packages can be pinned with apt-mark hold / dnf versionlock so an unattended upgrade does not swap a verified binary for an unverified one.",
    "Container images of the control plane are signed by the Kubernetes project; verify with cosign against the public key: cosign verify --key gcs://k8s-release-dev/cosign-public-... or keyless verification against the Kubernetes certificate transparency log.",
    "Image identity is the digest, not the tag: after verification, deploy by digest (registry/image@sha256:...) so what you verified is what runs."
  ],
  commands: [
    { cmd: "curl -LO https://dl.k8s.io/release/stable.txt", why: "Know the current stable version before you choose the release to verify." },
    { cmd: "curl -LO https://dl.k8s.io/release/v1.37.0/bin/linux/amd64/kubelet && curl -LO https://dl.k8s.io/release/v1.37.0/bin/linux/amd64/kubelet.sha256", why: "Grab the binary plus its published checksum." },
    { cmd: "echo \"$(cat kubelet.sha256)  kubelet\" | sha256sum --check", why: "The verification step itself: output must say 'kubelet: OK'." },
    { cmd: "sha256sum /usr/bin/kubelet /usr/bin/kubeadm /usr/bin/kubectl", why: "Show what is actually on the node today." },
    { cmd: "cosign verify ghcr.io/org/app:v1.0.0", why: "Keyless verification of a signed image against Fulcio/Rekor." },
    { cmd: "apt-mark showhold ; dpkg -l | grep -E 'kubelet|kubeadm|kubectl'", why: "Confirm the packages are pinned and which version is installed." }
  ],
  yaml: [
    {
      title: "Verify-then-deploy pattern (script)",
      body: `#!/usr/bin/env bash
set -euo pipefail
VERSION=$(curl -fsSL https://dl.k8s.io/release/stable.txt)
for BIN in kubelet kubeadm kubectl; do
  curl -fsSLO "https://dl.k8s.io/release/\${VERSION}/bin/linux/amd64/\${BIN}"
  curl -fsSLO "https://dl.k8s.io/release/\${VERSION}/bin/linux/amd64/\${BIN}.sha256"
  echo "$(cat "\${BIN}.sha256")  \${BIN}" | sha256sum --check
done
install -m 0755 kubelet kubeadm kubectl /usr/bin/
apt-mark hold kubelet kubeadm kubectl`
    }
  ],
  gotchas: [
    "A checksum you downloaded from the same host as the binary proves transport integrity, not authenticity - the real answer references the published release provenance (and ideally a signature).",
    "Do not confuse 'verify binaries' (host packages) with 'verify images' (cosign/Sigstore). The task wording tells you which one it wants.",
    "If a task asks to upgrade, verifying binaries is a prerequisite step that carries its own points - do it even when the main task is the upgrade."
  ],
  docs: [
    { label: "Kubernetes release artifacts + checksums", url: "https://kubernetes.io/releases/download/" },
    { label: "cosign verify usage", url: "https://docs.sigstore.dev/logging/overview/" }
  ]
},

/* ------------------------------------------------------------------ Cluster Hardening */

{
  id: "ch-rbac",
  domain: "cluster-hardening",
  title: "RBAC: least privilege, no wildcards, provable",
  tags: ["rbac", "clusterrole", "rolebinding", "can-i"],
  summary:
    "CKS tasks give you a broken permission set and ask you to narrow it. You must know Role vs ClusterRole, binding syntax, and how to prove the result with kubectl auth can-i.",
  notes: [
    "Role is namespaced; ClusterRole is cluster-scoped. A RoleBinding can reference a Role (same namespace) or a ClusterRole (granted inside that namespace). A ClusterRoleBinding grants cluster-wide.",
    "Verbs: get, list, watch, create, update, patch, delete, deletecollection, connect (proxy/exec/logs subresource access). Subresources are separate resources: pods/log, pods/exec, nodes/proxy, secrets is not a subresource.",
    "resourceNames restrict to named objects; apiGroups '' means core API group. Always name the exact apiGroups/resources instead of '*' - wildcards are the finding you are asked to remove.",
    "Subjects: user, group, serviceaccount. Aggregated ClusterRoles (aggregationRule.clusterRoleSelectors) let you compose an admin-like role from narrow roles - a common 'improve this role' answer.",
    "Impersonation is your debugging tool: --as and --as-group let you test the exact identity the task cares about.",
    "Default bindings in kube-system/kube-public (system:discovery, system:public-info-viewer, kubectl get clusterrolebindings) are the 'defaults' the blueprint wants you to trim."
  ],
  commands: [
    { cmd: "kubectl create role pod-reader --verb=get,list,watch --resource=pods -n prod", why: "Namespaced least-privilege role." },
    { cmd: "kubectl create rolebinding pod-reader-bind --role=pod-reader --user=jane -n prod", why: "Bind a Role inside a namespace." },
    { cmd: "kubectl create clusterrole ns-list --verb=list --resource=namespaces && kubectl create clusterrolebinding ns-list-bind --clusterrole=ns-list --group=dev", why: "Cluster-scoped permission for a group." },
    { cmd: "kubectl create clusterrolebinding app-bind --clusterrole=pod-reader --serviceaccount=prod:api-sa", why: "Service account binding: namespace:name form." },
    { cmd: "kubectl auth can-i --list --as=system:serviceaccount:prod:api-sa -n prod", why: "Dump everything an identity may do - the verification tool for half of the RBAC tasks." },
    { cmd: "kubectl auth can-i create secrets -n prod --as=system:serviceaccount:prod:api-sa", why: "Single-answer check; use it after every permission change." },
    { cmd: "kubectl get clusterrolebindings,rolebindings -A -o wide", why: "Find the overly broad binding you were asked to narrow." },
    { cmd: "kubectl get clusterrole edit -o yaml | grep -A5 rules", why: "Read the built-in roles you are meant to use instead of hand-rolling." },
    { cmd: "kubectl delete clusterrolebinding cluster-admin-binding", why: "Removing an accidental cluster-admin binding is a recurring CKS answer." }
  ],
  yaml: [
    {
      title: "Least-privilege Role + RoleBinding with resourceNames",
      body: `apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata: { name: app-viewer, namespace: prod }
rules:
- apiGroups: [""]
  resources: ["pods", "pods/log"]
  verbs: ["get", "list", "watch"]
- apiGroups: [""]
  resources: ["configmaps"]
  resourceNames: ["app-config"]
  verbs: ["get"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata: { name: app-viewer-bind, namespace: prod }
subjects:
- kind: ServiceAccount
  name: api-sa
  namespace: prod
roleRef:
  kind: Role
  name: app-viewer
  apiGroup: rbac.authorization.k8s.io`
    },
    {
      title: "Aggregated ClusterRole (compose a safe read-only admin)",
      body: `apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: readonly-aggregated
  labels:
    rbac.authorization.k8s.io/aggregate-to-readonly: "true"
rules:
- apiGroups: [""]
  resources: ["pods", "services", "endpoints", "configmaps"]
  verbs: ["get", "list", "watch"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata: { name: aggregated-readonly }
aggregationRule:
  clusterRoleSelectors:
  - matchLabels: { rbac.authorization.k8s.io/aggregate-to-readonly: "true" }
rules: []`
    }
  ],
  gotchas: [
    "roleRef is immutable. If the wrong role was bound, delete and recreate the binding - 'kubectl edit' will refuse the change.",
    "pods/log and pods/exec need their own entries; a rule for 'pods' does not grant logs or exec.",
    "A RoleBinding that references a Role in another namespace does not work - keep Role and RoleBinding in the same namespace.",
    "kubectl auth can-i checks your own identity by default; without --as you are testing the wrong user."
  ],
  docs: [
    { label: "RBAC reference (roles, verbs, subresources)", url: "https://kubernetes.io/docs/reference/access-authn-authz/rbac/" },
    { label: "Aggregated ClusterRoles", url: "https://kubernetes.io/docs/reference/access-authn-authz/rbac/#aggregated-clusterroles" }
  ]
},

{
  id: "ch-serviceaccounts",
  domain: "cluster-hardening",
  title: "Service accounts: disable defaults, minimize permissions",
  tags: ["serviceaccount", "projected-token", "bound-token", "automount"],
  summary:
    "Every Pod silently mounts a token with namespace permissions. CKS wants you to turn that off where it is not needed and to mint narrow, short-lived, audience-bound tokens where it is.",
  notes: [
    "automountServiceAccountToken: false at Pod level (and on the ServiceAccount itself) is the single highest-value default removal.",
    "Bound service account tokens (GA since v1.30) are short-lived, audience-scoped, and cannot be reused elsewhere. Flags: --service-account-issuer, --api-audiences, --service-account-signing-key-file.",
    "Use a projected volume with a serviceAccountToken source to get a token with the exact audience and expiration you need instead of the default mount.",
    "--service-account-lookup=true makes the API server reject tokens for deleted service accounts; disable defaults in controllers: --service-account-lookup plus the ServiceAccount admission plugin.",
    "The 'default' ServiceAccount of every namespace should get little or nothing; bind permissions to dedicated SAs per workload.",
    "Old static tokens (/var/run/secrets/kubernetes.io/serviceaccount) are the legacy mount; TokenRequest API (/serviceaccounts/<name>/token) is the modern one."
  ],
  commands: [
    { cmd: "kubectl create serviceaccount api-sa -n prod", why: "A dedicated SA instead of 'default'." },
    { cmd: "kubectl patch serviceaccount default -n prod -p '{\"automountServiceAccountToken\": false}'", why: "Kill the namespace default mount in one line." },
    { cmd: "kubectl get sa api-sa -n prod -o jsonpath='{.automountServiceAccountToken}'", why: "Check the SA-level setting." },
    { cmd: "kubectl create token api-sa -n prod --audience=api.example.com --duration=600s", why: "Mint a bound token to test an API call - the modern token workflow." },
    { cmd: "kubectl get --raw '/api/v1/serviceaccounts/api-sa/token?durationSeconds=600' -n prod", why: "The TokenRequest API behind 'kubectl create token'." },
    { cmd: "kubectl exec -it <pod> -- sh -c 'ls -l /var/run/secrets/kubernetes.io/serviceaccount'", why: "Prove whether a token is mounted in a running Pod." }
  ],
  yaml: [
    {
      title: "Pod with no default token, then an explicit narrow projected token",
      body: `apiVersion: v1
kind: Pod
metadata: { name: api, namespace: prod, labels: { app: api } }
spec:
  serviceAccountName: api-sa
  automountServiceAccountToken: false
  containers:
  - name: app
    image: ghcr.io/org/api:1.4.0@sha256:0000000000000000000000000000000000000000000000000000000000000000
    volumeMounts:
    - name: api-audience-token
      mountPath: /var/run/secrets/api.example.com/api-token
      readOnly: true
  volumes:
  - name: api-audience-token
    projected:
      sources:
      - serviceAccountToken:
          path: token
          expirationSeconds: 3600
          audience: api.example.com`
    },
    {
      title: "ServiceAccount with automount disabled",
      body: `apiVersion: v1
kind: ServiceAccount
metadata: { name: api-sa, namespace: prod }
automountServiceAccountToken: false`
    }
  ],
  gotchas: [
    "automountServiceAccountToken on the ServiceAccount beats the Pod default; the Pod setting beats the SA only for that Pod - if the Pod sets true and the SA sets false, the Pod wins.",
    "Bound tokens require the API server issuer/audience flags. Without them the legacy long-lived token is used and your 'hardening' is cosmetic - kube-bench and the grader look at those flags.",
    "Some controllers (DaemonSets used by CNI/monitoring) genuinely need API access; disabling their token breaks the cluster - scope the change to application Pods."
  ],
  docs: [
    { label: "Configure service account token projection", url: "https://kubernetes.io/docs/tasks/configure-pod-container/configure-service-account/" },
    { label: "Service account token security (bound tokens, audiences)", url: "https://kubernetes.io/docs/concepts/security/service-account-token/" }
  ]
},

{
  id: "ch-api-access",
  domain: "cluster-hardening",
  title: "Restrict access to the Kubernetes API",
  tags: ["api-server", "anonymous-auth", "audit", "admission", "ratelimit"],
  summary:
    "Authentication, authorisation and admission are three separate gates. Know which flag belongs to which gate, and how to show an attacker is blocked.",
  notes: [
    "AuthN: client certs (--client-ca-file), OIDC (--oidc-issuer-url, --oidc-client-id, --oidc-username-claim, --oidc-groups-claim), webhook (--authentication-token-webhook-config-file), ServiceAccount tokens. Anonymous must be off: --anonymous-auth=false.",
    "AuthZ chain: Node,RBAC (Node authorises kubelet's own Pod/Service/ConfigMap access; RBAC handles everyone else). ABAC and Webhook modes exist but Node,RBAC is the expected answer.",
    "Admission runs after authz and mutates/validates: always turn on NodeRestriction (limits a kubelet to its own Node object and labels), PodSecurity (PSA enforcement), and add ImagePolicyWebhook for image provenance.",
    "ImagePolicyWebhook needs --admission-control-config-file with an admission plugin config + a kubeconfig pointing at the webhook service; the webhook decides allow/deny on image provenance.",
    "Anonymous access to kube-public (kubeadm leftover) and /version, /healthz, /readyz endpoints is the metadata leak to close.",
    "Rate limiting and abuse control: --max-requests-inflight, --max-mutating-requests-inflight, --request-timeout; watch for a flood of LIST calls in the audit log."
  ],
  commands: [
    { cmd: "kubectl get --raw /version ; kubectl get --raw /healthz", why: "See whether anonymous access answers without credentials; it should not in a hardened cluster." },
    { cmd: "kubectl get clusterrolebindings -o wide | grep -E 'cluster-admin|system:unauthenticated|system:anonymous'", why: "Find anonymous/unauthenticated bindings that grant discovery or worse." },
    { cmd: "kubectl -n kube-system edit cm extension-apiserver-authentication", why: "Where requestheader client CA and proxy client common names live - a real leak if left default." },
    { cmd: "kubectl get --raw '/apis/authorization.k8s.io/v1/selfsubjectaccessreviews' 2>/dev/null | head -c 200", why: "Confirm self-subject access review is available for the identity you are testing." },
    { cmd: "grep -E 'anonymous|authorization-mode|enable-admission-plugins' /etc/kubernetes/manifests/kube-apiserver.yaml", why: "Read the three gates straight out of the manifest." }
  ],
  yaml: [
    {
      title: "Admission control config for ImagePolicyWebhook",
      body: `apiVersion: apiserver.config.k8s.io/v1alpha1
kind: AdmissionConfiguration
plugins:
- name: ImagePolicyWebhook
  configuration:
    imagePolicyFile: /etc/kubernetes/kube/image-policy-config.json
---
apiVersion: imagepolicy.k8s.io/v1alpha1
kind: ImagePolicyConfiguration
imagePolicy:
  evalMode: Audit
  connections:
    kubeconfigFile: /etc/kubernetes/kube/image-policy-kubeconfig.yaml
    timeout: 10
    retryAttempts: 2`
    }
  ],
  gotchas: [
    "Order matters: admission plugins listed in --enable-admission-plugins replace the default list. Writing only NodeRestriction removes PodSecurity, and PSA stops enforcing.",
    "evalMode: Deny on a webhook that is down locks every image out. Use Audit first, check the webhook logs, then switch to Deny.",
    "Deleting the system:discovery/system:public-info-viewer bindings breaks 'kubectl api-versions' for regular users - narrow, do not delete."
  ],
  docs: [
    { label: "AuthN/AuthZ/AuthN chain overview", url: "https://kubernetes.io/docs/reference/access-authn-authz/authorization/" },
    { label: "Admission controllers in practice (best practices page)", url: "https://kubernetes.io/docs/concepts/security/controlling-access/" }
  ]
},

{
  id: "ch-upgrade",
  domain: "cluster-hardening",
  title: "Upgrade Kubernetes to remove vulnerabilities",
  tags: ["kubeadm", "upgrade", "drain", "backup", "etcd"],
  summary:
    "A predictable, safe sequence: verify binaries, back up etcd, upgrade the control plane, then each worker (drain, upgrade kubelet+config, uncordon), then verify.",
  notes: [
    "kubeadm upgrade plan tells you the available target version; kubeadm upgrade apply v1.37.x on the first control plane, kubeadm upgrade node on the other control planes and workers.",
    "Order: kubeadm + kubectl binaries first (apt/dnf install pinned version), then 'kubeadm upgrade apply', then drain + kubelet/kubeadm package upgrade on every node, then 'kubeadm upgrade node' on that node, restart kubelet, uncordon.",
    "Drain safely: kubectl drain <node> --ignore-daemonsets --delete-emptydir-data --grace-period=60. Never delete a mirror Pod or a DaemonSet Pod by hand.",
    "etcd backup before anything else: etcdctl --cacert/--cert/--key snapshot save /var/lib/etcd/snapshot.db, and know etcdctl snapshot restore into a fresh data dir.",
    "Verify after upgrade: kubectl get nodes (version), kubectl get pods -A (all Running), kube-bench re-run, and your Falco/ingress controllers still Ready.",
    "Skew policy: kubelet may not be newer than the API server; upgrade control plane first, then nodes - the reverse fails."
  ],
  commands: [
    { cmd: "kubeadm upgrade plan", why: "Shows the current version, the supported next version, and which components are outdated." },
    { cmd: "kubeadm upgrade apply v1.37.1", why: "One control plane only; it migrates certs, static pods and the upgrade state ConfigMap." },
    { cmd: "kubeadm upgrade node", why: "Every other control plane node and every worker, run before you bump the kubelet package." },
    { cmd: "kubectl drain node2 --ignore-daemonsets --delete-emptydir-data --grace-period=60", why: "Evict workloads safely before touching the node." },
    { cmd: "apt-get update && apt-get install -y kubelet=1.37.1-1.1 kubeadm=1.37.1-1.1 kubectl=1.37.1-1.1 && apt-mark hold kubelet kubeadm kubectl && systemctl daemon-reload && systemctl restart kubelet", why: "The package half of the node upgrade, with pinning." },
    { cmd: "kubectl uncordon node2 && kubectl get nodes -o wide", why: "Bring the node back and confirm the new version is reported." },
    { cmd: "etcdctl --endpoints=https://127.0.0.1:2379 --cacert=/etc/kubernetes/pki/etcd/ca.crt --cert=/etc/kubernetes/pki/etcd/server.crt --key=/etc/kubernetes/pki/etcd/server.key snapshot save /var/lib/etcd/snapshot-$(date +%F).db", why: "The backup that makes an upgrade survivable." }
  ],
  yaml: [
    {
      title: "Full node-upgrade sequence to memorise",
      body: `# 0. verify binaries/checksums
# 1. etcd snapshot
# 2. control plane #1: apt install pinned kubeadm/kubectl; kubeadm upgrade apply vX
# 3. control plane #2..N: apt install pinned; kubeadm upgrade node; restart kubelet
# 4. workers, one at a time:
kubectl drain "$NODE" --ignore-daemonsets --delete-emptydir-data --grace-period=60
ssh "$NODE" 'apt-get update && apt-get install -y kubelet=V-1.1 kubeadm=V-1.1 && apt-mark hold kubelet kubeadm'
ssh "$NODE" 'kubeadm upgrade node'
ssh "$NODE" 'systemctl daemon-reload && systemctl restart kubelet'
kubectl uncordon "$NODE"
# 5. verify: kubectl get nodes; kubectl get pods -A | grep -v Running ; kube-bench run --summary`
    }
  ],
  gotchas: [
    "'kubeadm upgrade apply' must run on one control plane only; other control planes use 'kubeadm upgrade node'. This is the most common single mistake in the upgrade task.",
    "Drain fails with '--ignore-daemonsets' missing when a DaemonSet Pod exists, and fails on emptyDir Pods without '--delete-emptydir-data'. Know both flags.",
    "After the control plane upgrade, static Pod images change but a pinned kubelet on an old worker will report 'component unsupported' skew - finish the nodes before declaring success."
  ],
  docs: [
    { label: "kubeadm upgrade guide", url: "https://kubernetes.io/docs/tasks/administer-cluster/kubeadm/kubeadm-upgrade/" },
    { label: "etcd snapshot + restore instructions", url: "https://kubernetes.io/docs/tasks/administer-cluster/configure-upgrade-etcd/" }
  ]
},

/* ------------------------------------------------------------------ System Hardening */

{
  id: "sh-os-footprint",
  domain: "system-hardening",
  title: "Minimize host OS footprint (reduce attack surface)",
  tags: ["host", "sysctl", "kernel", "packages", "ssh"],
  summary:
    "Nodes are servers first. Remove packages you do not use, close ports, disable kernel features you do not need, and prove it with a port scan and a package list.",
  notes: [
    "A node should have: a container runtime, kubelet, kubeadm/kubectl (optional), the CNI/agent, and monitoring agents. Anything else (compilers, shells for debug, web servers, package managers reaching the internet) is attack surface.",
    "Ports to defend: 10250 kubelet, 10255 legacy read-only, 10256 kube-proxy healthz, 10257 controller-manager, 10259 scheduler, 2379/2380 etcd, 6443 API server, 30000-32767 NodePort range.",
    "Kernel hardening sysctls: kernel.kptr_restrict=2, kernel.yama.ptrace_scope=1, fs.protected_hardlinks=1, fs.protected_symlinks=1, fs.suid_dumpable=0, fs.protected_fifos=2, fs.protected_regular=2, vm.mmap_min_addr=65536, kernel.sysrq=0, net.ipv4.conf.all.rp_filter=1, net.ipv4.conf.all.accept_redirects=0, net.ipv4.conf.all.send_redirects=0, net.ipv4.conf.all.accept_source_route=0, net.ipv4.conf.all.log_martians=1, net.ipv4.tcp_syncookies=1, net.ipv4.icmp_echo_ignore_broadcasts=1.",
    "Disable unused kernel modules with /etc/modprobe.d/ files (install udf off, install cramfs off, install squashfs off, blacklist firewire-core, usb-storage if unused) - these are classic CIS host benchmarks.",
    "Turn off swap on nodes (kubelet refuses to run with swap by default in modern releases) and disable unneeded systemd services (sshd if you use SSM/Console, avahi, cups).",
    "Use a minimal base (Bottlerocket, Flatcar, Ubuntu minimal, or a hardened image) and make the root filesystem read-only where the runtime allows it."
  ],
  commands: [
    { cmd: "ss -tulnp", why: "Everything listening on the node; each line outside the Kubernetes port list is a finding." },
    { cmd: "systemctl list-units --type=service --state=running", why: "Find services to disable." },
    { cmd: "dpkg -l | wc -l   # rpm -qa | wc -l", why: "Package count is a footprint metric you can improve and re-measure." },
    { cmd: "sysctl kernel.kptr_restrict kernel.yama.ptrace_scope fs.protected_hardlinks net.ipv4.conf.all.rp_filter", why: "Read current kernel hardening state." },
    { cmd: "printf 'install udf /bin/false\\ninstall cramfs /bin/false\\ninstall squashfs /bin/false\\n' > /etc/modprobe.d/hardening.conf && rmmod udf 2>/dev/null; lsmod | grep -E 'udf|cramfs'", why: "Block unused filesystem modules and verify they are not loaded." },
    { cmd: "cat > /etc/sysctl.d/99-cks.conf <<'EOF'\nkernel.kptr_restrict=2\nkernel.yama.ptrace_scope=1\nfs.protected_hardlinks=1\nfs.protected_symlinks=1\nvm.mmap_min_addr=65536\nnet.ipv4.conf.all.rp_filter=1\nnet.ipv4.tcp_syncookies=1\nEOF\nsysctl --system", why: "Apply and load host kernel hardening in one shot." },
    { cmd: "nft list ruleset | head -50", why: "Show the node firewall you are expected to tighten (allow 6443/10250 from the cluster network only)." }
  ],
  yaml: [],
  gotchas: [
    "Do not 'fix' a node by installing tools you were told to remove - the task often wants the package list reduced, not enlarged.",
    "ptrace_scope=1 breaks some debuggers and some Falco/tracing workflows; note the tradeoff in your head instead of blindly applying every CIS control.",
    "kind/minikube nodes inside containers have a reduced host view; CIS host checks there report WARN even when the cluster itself is fine."
  ],
  docs: [
    { label: "Kubernetes hardening guide (security concepts)", url: "https://kubernetes.io/docs/concepts/security/" },
    { label: "CIS benchmarks for the host OS (Linux)", url: "https://www.cisecurity.org/benchmark/linux_operating_systems" }
  ]
},

{
  id: "sh-iam",
  domain: "system-hardening",
  title: "Least-privilege identity and access management",
  tags: ["iam", "sudo", "ssh", "node-identity", "certs"],
  summary:
    "Two planes: who may operate the node (OS users, SSH, sudo) and which identity Kubernetes grants cluster permissions (users, groups, service accounts, kubelet credentials).",
  notes: [
    "Node plane: no root login over SSH, key-only auth, a named operator user with narrow sudo, no shared accounts, TLS/agent-based sessions where the platform supports it.",
    "Cluster plane: map human identities to Kubernetes users/groups via OIDC or client certs; never hand out cluster-admin; use ClusterRole 'admin' scoped by RoleBinding where possible.",
    "kubelet identity is the System:node group with the NodeRestriction admission plugin limiting a kubelet to its own Node object and forbidding kubernetes.io/* label writes.",
    "Certificate rotation and revocation: know where the CA lives (/etc/kubernetes/pki/ca.crt), how long certs are valid (kubeadm 1 year, rotated with 'kubeadm certs renew all' + 'kubeadm init phase kubeconfig all' or by kubelet's rotateCertificates), and that removing a user's cert is how you revoke a human.",
    "Node users map to Kubernetes groups: system:nodes, system:serviceaccounts:<ns>, system:bootstrappers, system:kubeadm - useful when you must grant a kubelet something narrow."
  ],
  commands: [
    { cmd: "sudo grep -E 'PermitRootLogin|PasswordAuthentication|PubkeyAuthentication' /etc/ssh/sshd_config", why: "The SSH hardening checks that appear in CIS host benchmarks." },
    { cmd: "sudo sshd -T | grep -E 'permitrootlogin|passwordauthentication|pubkeyauthentication'", why: "Show the effective configuration, not just the file contents." },
    { cmd: "getent group sudo ; sudo -l -U operator", why: "Who can escalate, and how far." },
    { cmd: "kubectl config view --minify -o jsonpath='{.users[*].user}' ", why: "See what identity your kubeconfig uses (cert, token, OIDC)." },
    { cmd: "kubectl get secret -n kube-system | grep -E 'bootstrap-token|boot' ; kubectl get clusterrolebindings | grep -E 'system:bootstrap|system:node'", why: "Bootstrap token leakage is a real finding: the token lets a node join." },
    { cmd: "kubeadm token list ; kubeadm token delete <token>", why: "Remove the join token after your nodes are up." },
    { cmd: "openssl x509 -in /etc/kubernetes/pki/apiserver-kubelet-client.crt -noout -text | grep -A2 Subject", why: "Read the client identity the API server uses to reach kubelets (CN must be kubelet-client:CN)." },
    { cmd: "kubectl create clusterrole node-reader --verb=get,list --resource=nodes && kubectl create clusterrolebinding node-reader-sa --clusterrole=node-reader --group=system:nodes", why: "Give the kubelet group exactly what it needs, nothing more." }
  ],
  yaml: [
    {
      title: "OIDC-authenticated users mapped to groups",
      body: `# kube-apiserver static pod flags
- --oidc-issuer-url=https://auth.example.com/realms/k8s
- --oidc-client-id=kubernetes
- --oidc-username-claim=sub
- --oidc-groups-claim=groups
- --oidc-username-prefix=oidc:
# then bind by group name
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata: { name: sre-readonly }
subjects:
- kind: Group
  name: "sre"
  apiGroup: rbac.authorization.k8s.io
roleRef: { kind: ClusterRole, name: view, apiGroup: rbac.authorization.k8s.io }`
    }
  ],
  gotchas: [
    "Renewing kubeadm certificates requires 'kubeadm certs renew all' plus restarting the static Pods; kubelet client certs are rotated by the kubelet itself when rotateCertificates is true.",
    "A bootstrap token in a ConfigMap plus 'system:bootstrap:default' bound to a broad ClusterRole is a privilege escalation path - look for it in the 'harden this cluster' tasks.",
    "Kubernetes RBAC has no deny rule. Removing access means removing a binding, not adding a negative one."
  ],
  docs: [
    { label: "OIDC authentication flags", url: "https://kubernetes.io/docs/reference/access-authn-authz/authentication/" },
    { label: "NodeRestriction admission plugin", url: "https://kubernetes.io/docs/reference/access-authn-authz/admission-controllers/" }
  ]
},

{
  id: "sh-external",
  domain: "system-hardening",
  title: "Minimize external access to the network",
  tags: ["firewall", "nodeport", "loadbalancer", "exposure"],
  summary:
    "Nothing in a cluster should be reachable from the internet unless it is an Ingress. Practise shrinking NodePort ranges, filtering source ranges on load balancers, and closing node ports.",
  notes: [
    "Shrink the NodePort range: --service-node-port-range=30000-30100 on the API server. Fewer open ports, less blast radius.",
    "Prefer ClusterIP + Ingress over NodePort/LoadBalancer for anything that needs to be reached externally.",
    "Cloud security groups / nftables: allow 6443 and 10250 only from the cluster's own CIDR; allow 80/443 only to the ingress controller's LB; never allow 2379/2380 publicly.",
    "LoadBalancer source ranges: kubectl patch service with loadBalancerSourceRanges: [10.0.0.0/8] - an easy, verifiable improvement.",
    "Egress from the cluster: restrict outbound with egress NetworkPolicy or a CNI FQDN policy so a compromised Pod cannot dial a C2 host or a public package registry.",
    "HostNetwork Pods bypass service-level isolation - find them (kubectl get pods -A -field-selector spec.hostNetwork=true is not supported; use a jsonpath/grep) and justify or remove them."
  ],
  commands: [
    { cmd: "kubectl get svc -A | grep -E 'NodePort|LoadBalancer'", why: "Inventory the exposed services - the starting point of this task family." },
    { cmd: "kubectl patch svc api-lb -n prod -p '{\"spec\":{\"loadBalancerSourceRanges\":[\"10.20.0.0/16\"]}}'", why: "Restrict a load balancer to an internal source range." },
    { cmd: "kubectl get pods -A -o json | jq -r '.items[] | select(.spec.hostNetwork==true) | .metadata.namespace+\"/\"+.metadata.name'", why: "List Pods that share the node network namespace." },
    { cmd: "nft add rule inet filter input ip saddr 10.20.0.0/16 tcp dport 6443 accept", why: "Node firewall rule allowing the API server from the cluster network only." },
    { cmd: "kubectl -n kube-system edit cm kubeadm-config 2>/dev/null; grep -n 'service-node-port-range' /etc/kubernetes/manifests/kube-apiserver.yaml", why: "Find and shrink the NodePort range." }
  ],
  yaml: [
    {
      title: "Service with restricted load balancer source ranges",
      body: `apiVersion: v1
kind: Service
metadata: { name: api-lb, namespace: prod }
spec:
  type: LoadBalancer
  loadBalancerSourceRanges:
  - 10.20.0.0/16
  ports:
  - port: 443
    targetPort: 8443
  selector: { app: api }`
    }
  ],
  gotchas: [
    "NodePort range change requires an API server restart and can orphan existing NodePort Services - check that current NodePorts are inside the new range before you apply it.",
    "loadBalancerSourceRanges is provider-dependent (works on most managed LBs); on a bare-metal cluster use the node firewall or the ingress controller instead.",
    "kind exposes ports on 127.0.0.1 by extraPortMappings, so your laptop is 'outside' the cluster - a convenient way to practise external exposure checks."
  ],
  docs: [
    { label: "Services: NodePort/LoadBalancer exposure", url: "https://kubernetes.io/docs/concepts/services-networking/service/" },
    { label: "Kubernetes attack surface / defense in depth", url: "https://kubernetes.io/docs/concepts/security/" }
  ]
},

{
  id: "sh-apparmor",
  domain: "system-hardening",
  title: "AppArmor: confine the container with a kernel profile",
  tags: ["apparmor", "kernel", "profile", "apparmorProfile"],
  summary:
    "Load a profile on the node, then reference it from the Pod. Know the modern securityContext.appArmorProfile field and that the old Pod annotation is gone.",
  notes: [
    "Check the node first: aa-status shows loaded profiles; the AppArmor kernel module must be present (not in every cloud/WSL kernel - verify before promising it works).",
    "Load a Localhost profile onto each node the Pod may land on (apparmor_parser -r -W /etc/apparmor.d/profiles/my-app), or ship profiles with a DaemonSet that mounts /etc/apparmor.d.",
    "Modern API (GA since v1.30): securityContext.appArmorProfile: { type: Localhost, localhostProfile: profiles/my-app } at Pod or container level. type: RuntimeDefault or Unconfined are the other options.",
    "The annotation container.apparmor.security.beta.kubernetes.io/<container-name> is deprecated and removed in recent releases - if you write it, the task fails.",
    "Profile value: deny writes to sensitive /proc and /sys paths, block mount/ptracing, restrict capability use, and confine file access to the container's own paths.",
    "AppArmor logs denials to the kernel log (dmesg/journalctl) - 'aa-logprof' helps you turn denials into a tighter profile."
  ],
  commands: [
    { cmd: "aa-status 2>/dev/null || echo 'AppArmor not available on this node'", why: "Always confirm capability before designing the answer." },
    { cmd: "apparmor_parser -r -W /etc/apparmor.d/containers/app-api", why: "Load (or replace) a profile on the node." },
    { cmd: "aa-status --json 2>/dev/null | jq '.profiles' | head", why: "Prove the profile is loaded and in enforce mode." },
    { cmd: "journalctl -k | grep -i apparmor | tail -20", why: "Read denial events after you applied the profile - this is your proof it works." },
    { cmd: "kubectl get pod api -n prod -o jsonpath='{.spec.securityContext.appArmorProfile}'", why: "Verify the Pod actually requests your profile." },
    { cmd: "kubectl get pod api -n prod -o jsonpath='{.status.containerStatuses[0].allocatablePodResources}' 2>/dev/null; kubectl describe pod api -n prod | grep -i apparmor", why: "Events show 'apparmor profile ... not found' when the node lacks the profile." }
  ],
  yaml: [
    {
      title: "Profile file on the node (/etc/apparmor.d/containers/app-api)",
      body: `#include <tunables/global>
profile app-api flags=(attach_disconnected,mediate_deleted) {
  #include <abstractions/base>
  network,
  capability,
  file,
  umask,
  deny @{PROC}/* w,
  deny @{PROC}/sys/kernel/core_pattern w,
  deny @{PROC}/sysrq-trigger rwklx,
  deny @{PROC}/sys/kernel/** wklx,
  deny mount,
  deny /sys/[^{0-9}]/** wklx,
  deny /sys/**/power/** wklx,
  deny /sys/**/remount wklx,
  deny ptrace (trace) by=<none>,
}`
    },
    {
      title: "Pod using the Localhost profile",
      body: `apiVersion: v1
kind: Pod
metadata: { name: api, namespace: prod, labels: { app: api } }
spec:
  securityContext:
    appArmorProfile:
      type: Localhost
      localhostProfile: containers/app-api
  containers:
  - name: app
    image: ghcr.io/org/api:1.4.0
    securityContext:
      allowPrivilegeEscalation: false
      capabilities: { drop: ["ALL"] }`
    }
  ],
  gotchas: [
    "Localhost profile path is relative to the node's AppArmor profile directory (/etc/apparmor.d). If you load the profile under a different path, the Pod fails with 'profile not found'.",
    "AppArmor and seccomp can both confine syscalls; a task may ask for one of them specifically - re-read the wording.",
    "On WSL2/Ubuntu cloud kernels AppArmor may be present but disabled (apparmor.service masked). Fix the node first; you cannot practise AppArmor on a kernel that lacks it."
  ],
  docs: [
    { label: "AppArmor tutorial on kubernetes.io", url: "https://kubernetes.io/docs/tutorials/security/apparmor/" },
    { label: "AppArmor profile syntax", url: "https://apparmor.net/documentation/" }
  ]
},

{
  id: "sh-seccomp",
  domain: "system-hardening",
  title: "seccomp: limit which syscalls a container may use",
  tags: ["seccomp", "runtimedefault", "localhost", "syscall"],
  summary:
    "The quick win is seccompProfile: RuntimeDefault on every Pod. The deep win is a custom Localhost profile with a default-deny syscall list.",
  notes: [
    "Pod/container level: securityContext.seccompProfile.type = RuntimeDefault | Unconfined | Localhost (+ localhostProfile path). Container level overrides Pod level.",
    "RuntimeDefault blocks the dangerous syscall families the runtime disallows (mount, reboot, ptrace scope, module loading, swap, raw sockets...). It is the baseline answer when a task says 'set a seccomp profile'.",
    "Localhost profiles are JSON files under the kubelet's root dir: /var/lib/kubelet/seccomp/profiles/<name>.json (kubelet --root-dir). They must exist on the node the Pod is scheduled to.",
    "A custom profile starts with defaultAction SCMP_ACT_ERRNO and an allow list. Missing syscalls show up as EPERM/ECHO failures in the app - iterate with strace until the list is right.",
    "Audit logging of seccomp denials: sysctl kernel.seccomp.actions_logged = 'kill_process kill_thread trap errno log' and read dmesg.",
    "Deprecated: the seccomp.security.alpha.kubernetes.io/pod annotation - replaced by seccompProfile since v1.25."
  ],
  commands: [
    { cmd: "kubectl get pod api -n prod -o jsonpath='{.spec.securityContext.seccompProfile}{\"\\n\"}'", why: "Verify the profile actually got set on the Pod." },
    { cmd: "mkdir -p /var/lib/kubelet/seccomp/profiles && cp fake.json /var/lib/kubelet/seccomp/profiles/", why: "Install a Localhost seccomp profile on the node (kind: kind cp fake.json kind-control-plane:/var/lib/kubelet/seccomp/profiles/)." },
    { cmd: "cat /proc/$(pgrep -f 'containerd|crio' | head -1)/status | grep Seccomp", why: "Show the kernel seccomp mode a runtime process is in (2 = filter mode)."},
    { cmd: "dmesg -T | grep -i seccomp | tail -20", why: "Read blocked syscall events: this is the proof your profile works." },
    { cmd: "sysctl kernel.seccomp.actions_logged", why: "Check denials are actually being logged." }
  ],
  yaml: [
    {
      title: "Pod with RuntimeDefault + a node-local custom profile",
      body: `apiVersion: v1
kind: Pod
metadata: { name: strict, namespace: prod }
spec:
  securityContext:
    seccompProfile:
      type: Localhost
      localhostProfile: profiles/fake.json
  containers:
  - name: app
    image: busybox:1.36
    command: ["sh","-c","echo hi; sleep 3600"]
    securityContext:
      allowPrivilegeEscalation: false
      seccompProfile:
        type: RuntimeDefault`
    },
    {
      title: "Custom seccomp profile (default deny, small allow list)",
      body: `{
  "defaultAction": "SCMP_ACT_ERRNO",
  "architectures": ["SCMP_ARCH_X86_64", "SCMP_ARCH_X86", "SCMP_ARCH_X32"],
  "syscalls": [
    { "names": ["read","write","open","close","stat","fstat","lstat","poll","lseek","mmap","mprotect","munmap","brk","rt_sigaction","rt_sigprocmask","rt_sigreturn","ioctl","access","pipe","select","sched_yield","mremap","munmap","nanosleep","getuid","getgid","geteuid","getegid","getpid","getppid","getpgrp","statx","newfstatat","exit","exit_group","clone","clone3","execve","arch_prctl","set_tid_address","set_robust_list","rseq","clock_gettime","futex","dup","dup2","fcntl","getrandom","readlink","unlink","mkdir","rmdir","rename","chdir","getcwd","writev","readv"],
      "action": "SCMP_ACT_ALLOW" }
  ]
}`
    }
  ],
  gotchas: [
    "The Localhost profile path is relative to <kubelet root-dir>/seccomp/, not to an absolute path you choose. Get the directory wrong and the Pod is rejected with 'seccomp profile not found'.",
    "A too-tight profile breaks the runtime: Go programs need rseq/set_robust_list, glibc needs more syscalls than a static binary. Start from RuntimeDefault, then trim.",
    "Falco's modern_ebpf driver and seccomp filters interact: a syscall blocked by seccomp never reaches Falco. Know both when a task asks you to 'detect and block'."
  ],
  docs: [
    { label: "seccomp profiles on kubernetes.io (Localhost profile example)", url: "https://kubernetes.io/docs/tutorials/security/seccomp/" },
    { label: "RuntimeDefault profile contents (container runtime docs)", url: "https://kubernetes.io/docs/tutorials/security/seccomp/" }
  ]
}
);
