/*
 * CKS DRILLS - author a command or manifest, get graded feedback.
 *
 * kind: "shell" | "yaml" | "dockerfile"
 * need:  every {label, re} must match your answer.
 * avoid: any {label, re} that matches marks the answer unsafe (anti-pattern).
 *
 * Grading normalizes the answer first: lowercase, single/double quotes removed,
 * all whitespace (including newlines and indentation) collapsed to single spaces.
 * So indentation is never graded, quotes are invisible to the checker, and
 * "policyTypes:\n- Ingress" is graded as "policytypes: - ingress".
 * Patterns are therefore written quote-free and use bounded windows like .{0,80}
 * when ordering matters.
 */

window.CKS_DRILLS = [

/* ================= Cluster Setup ================= */
{
  id: "d-netpol-deny", kind: "yaml", domain: "cluster-setup", difficulty: "easy", minutes: 3,
  title: "Default-deny every inbound connection in namespace prod",
  prompt: "Write the manifest for a NetworkPolicy in namespace 'prod' that drops every inbound connection to every Pod in that namespace.",
  hints: ["An empty podSelector means 'all Pods in this policy's namespace'.", "policyTypes alone creates the deny: with no rules for that direction, everything is dropped."],
  need: [
    { label: "kind: NetworkPolicy", re: "kind:\\s*NetworkPolicy" },
    { label: "metadata.namespace prod", re: "namespace:\\s*prod" },
    { label: "empty podSelector", re: "podSelector:\\s*\\{\\s*\\}" },
    { label: "policyTypes includes Ingress", re: "policyTypes:\\s*\\[?\\s*-{0,1}\\s*Ingress" }
  ],
  avoid: [
    { label: "an allow-everything rule defeats it", re: "cidr:\\s*0\\.0\\.0\\.0/0" },
    { label: "a named podSelector is not default-deny", re: "podSelector:\\s*matchLabels" }
  ],
  solution:
`apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny-ingress
  namespace: prod
spec:
  podSelector: {}
  policyTypes:
  - Ingress`,
  why: "As soon as any policy selects a Pod for a direction, that Pod becomes isolated for the whole direction. policyTypes: [Ingress] with no ingress rules therefore also blocks same-namespace traffic and the load-balancer path - which is why the allow rules come next."
},
{
  id: "d-netpol-allow-dns", kind: "yaml", domain: "cluster-setup", difficulty: "medium", minutes: 5,
  title: "Egress allow-list that keeps DNS alive",
  prompt: "Write a NetworkPolicy for namespace 'prod' that denies all egress but allows DNS to kube-dns in kube-system and TCP 8080 to the Pod labelled app=payments in namespace payments.",
  hints: ["Block UDP 53 and every service name in the namespace stops resolving.", "A namespaceSelector and a podSelector inside the SAME list entry are ANDed.", "kubernetes.io/metadata.name is the built-in label that selects a namespace by name."],
  need: [
    { label: "kind: NetworkPolicy", re: "kind:\\s*NetworkPolicy" },
    { label: "policyTypes includes Egress", re: "policyTypes:\\s*\\[?\\s*-{0,1}\\s*Egress" },
    { label: "DNS port 53 over UDP", re: "port:\\s*53.{0,40}UDP" },
    { label: "selects the kube-system namespace", re: "namespaceSelector.{0,120}kubernetes\\.io/metadata\\.name:\\s*kube-system" },
    { label: "selects the payments Pod", re: "app:\\s*payments" },
    { label: "port 8080 for the backend", re: "port:\\s*8080" }
  ],
  avoid: [
    { label: "0.0.0.0/0 egress is not an allow-list", re: "0\\.0\\.0\\.0/0" },
    { label: "an empty namespaceSelector allows every namespace", re: "namespaceSelector:\\s*\\{\\s*\\}" }
  ],
  solution:
`apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: prod-egress-allowlist
  namespace: prod
spec:
  podSelector: {}
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
    - port: 53
      protocol: UDP
    - port: 53
      protocol: TCP
  - to:
    - namespaceSelector:
        matchLabels:
          kubernetes.io/metadata.name: payments
      podSelector:
        matchLabels:
          app: payments
    ports:
    - port: 8080
      protocol: TCP`,
  why: "Test from a throwaway Pod inside prod: kubectl run probe --rm -it --image=busybox:1.36 --restart=Never -n prod -- sh, then nslookup kubernetes.default.svc.cluster.local and wget -qO- --timeout=3 http://POD_IP:8080/."
},
{
  id: "d-netpol-metadata", kind: "yaml", domain: "cluster-setup", difficulty: "hard", minutes: 5,
  title: "Keep Pods away from the instance metadata service",
  prompt: "Write a NetworkPolicy for namespace 'prod' that blocks the cloud metadata endpoint 169.254.169.254 while still allowing DNS, intra-namespace traffic and one internal API at 10.10.20.5.",
  hints: ["IPBlock is the only NetworkPolicy construct that speaks in IP ranges - and it only works for egress.", "Restricting egress is a chain of allows, not a single deny rule."],
  need: [
    { label: "policyTypes includes Egress", re: "policyTypes:\\s*\\[?\\s*-{0,1}\\s*Egress" },
    { label: "ipBlock used", re: "ipBlock" },
    { label: "169.254.169.254 named", re: "169\\.254\\.169\\.254" },
    { label: "except used to subtract it", re: "except" },
    { label: "DNS still allowed", re: "port:\\s*53" },
    { label: "intra-namespace allow via empty podSelector", re: "podSelector:\\s*\\{\\s*\\}.{0,120}to:" }
  ],
  avoid: [
    { label: "no whole-internet cidr", re: "cidr:\\s*0\\.0\\.0\\.0/0" },
    { label: "do not allow NodePort-range ports", re: "port:\\s*3[0-9]{4}" },
    { label: "do not put 169.254.169.254 in a cidr you allow", re: "cidr:\\s*169\\.254\\.169\\.254" }
  ],
  solution:
`apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: prod-egress-restricted
  namespace: prod
spec:
  podSelector: {}
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
    - port: 53
      protocol: UDP
  - to:
    - podSelector: {}
  - to:
    - ipBlock:
        cidr: 10.10.0.0/16
        except:
        - 169.254.169.254/32
  - to:
    - ipBlock:
        cidr: 10.10.20.5/32`,
  why: "Verify inside the cluster: kubectl run probe --rm -it --image=busybox:1.36 --restart=Never -n prod -- sh -c 'wget -qO- --timeout=3 http://169.254.169.254/latest/meta-data/ || echo BLOCKED'. Most cloud credential theft starts with egress that was never restricted."
},
{
  id: "d-apiserver-flags", kind: "yaml", domain: "cluster-hardening", difficulty: "medium", minutes: 5,
  title: "Harden the kube-apiserver static pod",
  prompt: "Add the kube-apiserver command flags that disable anonymous auth, use Node plus RBAC authorization, enable NodeRestriction, and forbid privileged containers on the control plane.",
  hints: ["In a static pod manifest the flags are one '- --flag=value' line each, under spec.containers[].command.", "Read the flags already present and append - admission plugin names move between releases."],
  need: [
    { label: "--anonymous-auth=false", re: "--anonymous-auth=false" },
    { label: "--authorization-mode with Node and RBAC", re: "--authorization-mode=\\S*Node.{0,20}RBAC" },
    { label: "--enable-admission-plugins includes NodeRestriction", re: "--enable-admission-plugins=\\S*NodeRestriction" },
    { label: "--allow-privileged=false", re: "--allow-privileged=false" }
  ],
  avoid: [
    { label: "anonymous auth enabled", re: "--anonymous-auth=true" },
    { label: "allow-privileged true", re: "--allow-privileged=true" },
    { label: "legacy insecure port or wildcard bind", re: "--insecure-port|--address=0\\.0\\.0\\.0" }
  ],
  solution:
`    command:
    - kube-apiserver
    - --anonymous-auth=false
    - --authorization-mode=Node,RBAC
    - --enable-admission-plugins=NodeRestriction
    - --allow-privileged=false
    - --bind-address=10.0.0.11
    - --tls-cert-file=/etc/kubernetes/pki/apiserver.crt
    - --tls-private-key-file=/etc/kubernetes/pki/apiserver.key`,
  why: "Confirm the change took effect without touching the node: kubectl get pods -n kube-system | grep apiserver (the kubelet restarts the static pod when the manifest changes), then kubectl get --raw /metrics | grep -m1 apiserver_request_total to prove the API still answers."
},
{
  id: "d-etcd-hardening", kind: "yaml", domain: "cluster-hardening", difficulty: "hard", minutes: 5,
  title: "etcd with mutual TLS on an internal interface",
  prompt: "Write the etcd static-pod command so clients must present a CA-signed certificate, the client endpoint listens only on the node's internal address, and peers also authenticate.",
  hints: ["--client-cert-auth only enforces client certificates when a trusted CA file is set.", "Never listen on 0.0.0.0 for a data store."],
  need: [
    { label: "--client-cert-auth=true", re: "--client-cert-auth=true" },
    { label: "--trusted-ca-file set", re: "--trusted-ca-file=\\S+" },
    { label: "client URL not a wildcard", re: "--listen-client-urls=https://(?!0\\.0\\.0\\.0)\\S+" },
    { label: "--listen-peer-urls set", re: "--listen-peer-urls=\\S+" },
    { label: "peer certificate auth set", re: "--peer-client-cert-auth=true" }
  ],
  avoid: [
    { label: "auto-TLS generates untrusted certs", re: "--(peer-)?auto-tls" },
    { label: "wildcard client listener", re: "--listen-client-urls=\\S*0\\.0\\.0\\.0" }
  ],
  solution:
`    command:
    - etcd
    - --name=etcd-0
    - --data-dir=/var/lib/etcd
    - --advertise-client-urls=https://10.0.0.11:2379
    - --listen-client-urls=https://10.0.0.11:2379
    - --listen-peer-urls=https://10.0.0.11:2380
    - --client-cert-auth=true
    - --trusted-ca-file=/var/lib/etcd-certs/ca.crt
    - --cert-file=/var/lib/etcd-certs/etcd-server.crt
    - --key-file=/var/lib/etcd-certs/etcd-server.key
    - --peer-client-cert-auth=true
    - --peer-trusted-ca-file=/var/lib/etcd-certs/ca.crt
    - --peer-cert-file=/var/lib/etcd-certs/etcd-peer.crt
    - --peer-key-file=/var/lib/etcd-certs/etcd-peer.key`,
  why: "Prove it from the node: ETCDCTL_API=3 etcdctl --cacert=/var/lib/etcd-certs/ca.crt --cert=/var/lib/etcd-certs/etcd-client.crt --key=/var/lib/etcd-certs/etcd-client.key get /registry --prefix --keys-only. The same command without the client cert must fail."
},
{
  id: "d-kubeadm-endpoint", kind: "shell", domain: "cluster-hardening", difficulty: "medium", minutes: 3,
  title: "Control plane behind an internal endpoint",
  prompt: "Give the kubeadm init command line that makes every control-plane component use the load-balancer name internal-api.example.internal:6443, prints the join command for later, and writes the config it used.",
  hints: ["controlPlaneEndpoint is what all members and kubeconfig files use.", "--print-join-command is the flag you want; keep the InitConfiguration file for reproducibility."],
  need: [
    { label: "kubeadm init", re: "kubeadm\\s+init\\b" },
    { label: "--control-plane-endpoint set", re: "--control-plane-endpoint=?internal-api\\.example\\.internal:6443" },
    { label: "--print-join-command", re: "--print-join-command" },
    { label: "an InitConfiguration file passed", re: "--config=\\S+" }
  ],
  avoid: [
    { label: "do not point the cluster at localhost", re: "--control-plane-endpoint=\\S*127\\.0\\.0\\.1" },
    { label: "--apiserver-advertise-address alone is not the shared endpoint", re: "^kubeadm\\s+init\\s+--apiserver-advertise-address" }
  ],
  solution:
`kubeadm init --config=init-config.yaml --control-plane-endpoint=internal-api.example.internal:6443 --print-join-command | tee /root/join-command.txt`,
  why: "controlPlaneEndpoint decides the address that lands in every admin kubeconfig and certificate SAN. Save the join command: it embeds the discovery token and CA hash, and tokens expire (kubeadm token create --print-join-command regenerates both)."
},

/* ================= Cluster Hardening ================= */
{
  id: "d-rbac-least-priv", kind: "yaml", domain: "cluster-hardening", difficulty: "medium", minutes: 6,
  title: "Least-privilege Role for a ServiceAccount",
  prompt: "Give ServiceAccount deploy-sa in namespace app read-only access to Pods and Pod logs in app only. Write both objects.",
  hints: ["Logs are a subresource: pods/log.", "Role and RoleBinding must both carry the namespace, and roleRef must be kind Role."],
  need: [
    { label: "kind: Role", re: "kind:\\s*Role\\b" },
    { label: "pods and pods/log listed", re: "resources:\\s*\\[?\\s*-?\\s*pods.{0,40}pods/log" },
    { label: "read-only verbs", re: "verbs:\\s*\\[?\\s*-?\\s*get.{0,60}list.{0,40}watch" },
    { label: "kind: RoleBinding", re: "kind:\\s*RoleBinding" },
    { label: "subject is the ServiceAccount", re: "subjects:[^]{0,200}kind:\\s*ServiceAccount.{0,60}name:\\s*deploy-sa" },
    { label: "roleRef kind Role", re: "roleRef:[^]{0,120}kind:\\s*Role\\b" }
  ],
  avoid: [
    { label: "a ClusterRoleBinding widens it", re: "kind:\\s*ClusterRoleBinding" },
    { label: "wildcard resources or verbs", re: "(resources|verbs):\\s*\\[?\\s*-?\\s*\\*" }
  ],
  solution:
`apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: pod-reader
  namespace: app
rules:
- apiGroups: [""]
  resources: ["pods", "pods/log"]
  verbs: ["get", "list", "watch"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: deploy-sa-pod-reader
  namespace: app
subjects:
- kind: ServiceAccount
  name: deploy-sa
  namespace: app
roleRef:
  kind: Role
  name: pod-reader
  apiGroup: rbac.authorization.k8s.io`,
  why: "Prove it from the subject's point of view: kubectl auth can-i get pods/log --as=system:serviceaccount:app:deploy-sa and kubectl auth can-i --list --as=system:serviceaccount:app:deploy-sa. That is what an examiner checks, not the YAML itself."
},
{
  id: "d-rbac-audit", kind: "shell", domain: "cluster-hardening", difficulty: "easy", minutes: 2,
  title: "Find every cluster-admin binding",
  prompt: "One command chain that lists every binding of the cluster-admin ClusterRole with the subject kind, name and namespace.",
  hints: ["ClusterRoleBindings are cluster-scoped, so -A is unnecessary.", "jq -r with @tsv gives a table you can act on."],
  need: [
    { label: "get clusterrolebindings", re: "get\\s+clusterrolebindings" },
    { label: "filters on cluster-admin", re: "cluster-admin" },
    { label: "selects roleRef", re: "roleRef\\.name" },
    { label: "prints subjects", re: "subjects" }
  ],
  avoid: [
    { label: "do not delete bindings before reviewing them", re: "delete\\s+clusterrolebinding" },
    { label: "do not hand out cluster-admin", re: "create\\s+clusterrolebinding" }
  ],
  solution:
`kubectl get clusterrolebindings -o json | jq -r '
  .items[] | select(.roleRef.name=="cluster-admin")
  | [.metadata.name, (.subjects[]? | "\\(.kind):\\(.name):\\(.namespace // "-")")] | @tsv'`,
  why: "Also worth running: kubectl get clusterrolebindings -o json | jq -r '.items[] | select(.subjects[]?.kind==\"ServiceAccount\") | .metadata.name' to see which workload identities hold cluster-wide rights."
},
{
  id: "d-rbac-escalation", kind: "shell", domain: "cluster-hardening", difficulty: "medium", minutes: 3,
  title: "Prove a user cannot grant rights they lack",
  prompt: "Show that user 'dev-lead' cannot bind the cluster-admin ClusterRole, then show what they can actually do.",
  hints: ["Binding a role you do not hold requires verb bind on that role; raising privileges requires escalate.", "kubectl auth can-i answers both as another identity."],
  need: [
    { label: "can-i check for bind on clusterroles", re: "auth\\s+can-i\\s+bind\\s+clusterroles/cluster-admin" },
    { label: "--as used for dev-lead", re: "--as=?user:dev-lead|--as=dev-lead" },
    { label: "effective permission list", re: "auth\\s+can-i\\s+--list" },
    { label: "--list scoped to a namespace", re: "-n\\s+app|--namespace=?app" }
  ],
  avoid: [
    { label: "do not create the binding to test it", re: "create\\s+clusterrolebinding" },
    { label: "do not use --as-group admin", re: "--as-group=?system:admin" }
  ],
  solution:
`kubectl auth can-i bind clusterroles/cluster-admin --as=dev-lead
kubectl auth can-i escalate --as=dev-lead
kubectl auth can-i --list --as=dev-lead -n app`,
  why: "The first two must print 'no' - that is the RBAC escalation-prevention guarantee. If a task wants a user to grant access, they get a Role with the exact rights plus bind on that Role only."
},
{
  id: "d-sa-token", kind: "shell", domain: "cluster-hardening", difficulty: "easy", minutes: 2,
  title: "Short-lived, audience-bound token",
  prompt: "Create a ServiceAccount token for ci-sa in namespace ci bound to audience ci.example.internal, valid one hour, captured into an environment variable instead of a file.",
  hints: ["kubectl create token is the supported path.", "Decode the payload yourself to confirm aud and exp."],
  need: [
    { label: "kubectl create token ci-sa", re: "create\\s+token\\s+ci-sa" },
    { label: "--audience set", re: "--audience=ci\\.example\\.internal" },
    { label: "namespace ci", re: "-n\\s+ci|--namespace=ci" },
    { label: "--duration set", re: "--duration=3600" }
  ],
  avoid: [
    { label: "not a long-lived generic Secret", re: "create\\s+secret\\s+generic" },
    { label: "token not written to a world-readable file", re: ">\\s*/tmp/\\S+" }
  ],
  solution:
`export CI_TOKEN=$(kubectl create token ci-sa -n ci --audience=ci.example.internal --duration=3600s)
echo $CI_TOKEN | cut -d. -f2 | base64 -d 2>/dev/null | jq -R fromjson? | jq {aud,exp,sub}`,
  why: "Confirm the claims you are claiming: aud must be your audience and exp about an hour ahead. For a Pod-mounted credential use the projected volume drill instead."
},
{
  id: "d-projected-token", kind: "yaml", domain: "cluster-hardening", difficulty: "medium", minutes: 5,
  title: "Projected ServiceAccount token volume",
  prompt: "Write a Pod that disables automatic token mounting and mounts a projected ServiceAccount token with audience vault and a 600 second lifetime at /var/run/secrets/api.",
  hints: ["projected.sources[].serviceAccountToken carries audience, expirationSeconds and path.", "automountServiceAccountToken: false is a Pod-level (and ServiceAccount-level) field."],
  need: [
    { label: "automountServiceAccountToken: false", re: "automountServiceAccountToken:\\s*false" },
    { label: "projected volume", re: "projected:" },
    { label: "serviceAccountToken source", re: "serviceAccountToken:" },
    { label: "audience vault", re: "audience:\\s*vault" },
    { label: "expirationSeconds 600", re: "expirationSeconds:\\s*600" },
    { label: "mountPath used", re: "mountPath:\\s*/var/run/secrets/api" }
  ],
  avoid: [
    { label: "not a legacy SA token Secret", re: "secret:\\s*name:\\s*\\S*service-account-token" },
    { label: "no hostPath for credentials", re: "hostPath" }
  ],
  solution:
`apiVersion: v1
kind: Pod
metadata:
  name: vault-client
  namespace: ci
spec:
  automountServiceAccountToken: false
  serviceAccountName: ci-sa
  containers:
  - name: app
    image: registry.internal.local/ci/app@sha256:REPLACE
    volumeMounts:
    - name: api-token
      mountPath: /var/run/secrets/api
      readOnly: true
  volumes:
  - name: api-token
    projected:
      sources:
      - serviceAccountToken:
          audience: vault
          expirationSeconds: 600
          path: token`,
  why: "expirationSeconds is the field a grader looks for. Verify inside the Pod: kubectl exec vault-client -- sh -c 'ls -l /var/run/secrets/api' and compare the token payload across two reads to watch it rotate."
},
{
  id: "d-kubelet-config", kind: "yaml", domain: "cluster-hardening", difficulty: "medium", minutes: 4,
  title: "KubeletConfiguration hardening",
  prompt: "Write the KubeletConfiguration keys that close the unauthenticated read-only endpoint, disable anonymous auth, keep webhook authentication, and require CA-authenticated clients.",
  hints: ["On kubeadm nodes the file is /var/lib/kubelet/config.yaml.", "Restart the kubelet after editing it."],
  need: [
    { label: "kubelet.config.k8s.io apiVersion", re: "kubelet\\.config\\.k8s\\.io" },
    { label: "kind: KubeletConfiguration", re: "kind:\\s*KubeletConfiguration" },
    { label: "readOnlyPort: 0", re: "readOnlyPort:\\s*0" },
    { label: "anonymous auth disabled", re: "anonymous.{0,4}enabled:\\s*false|anonymousAuth:\\s*false|anonymous-auth[= ]false" },
    { label: "clientCAFile set", re: "clientCAFile:\\s*\\S+" },
    { label: "authorization is webhook", re: "webhook" }
  ],
  avoid: [
    { label: "authorization must not be AlwaysAllow", re: "authorizationMode:\\s*AlwaysAllow|mode:\\s*AlwaysAllow" },
    { label: "the read-only port reopened", re: "readOnlyPort:\\s*10255" }
  ],
  solution:
`apiVersion: kubelet.config.k8s.io/v1beta1
kind: KubeletConfiguration
readOnlyPort: 0
authentication:
  anonymous:
    enabled: false
  webhook:
    enabled: true
  x509:
    clientCAFile: /etc/kubernetes/pki/ca.crt
authorization:
  mode: Webhook`,
  why: "Prove it on the node: curl -sk https://127.0.0.1:10250/pods must be Unauthorized and curl -s http://127.0.0.1:10255/pods must fail to connect. kube-bench node checks show the before/after."
},
{
  id: "d-kube-bench", kind: "shell", domain: "cluster-hardening", difficulty: "medium", minutes: 4,
  title: "Run CIS checks against a live cluster",
  prompt: "Start kube-bench and read back its results, then pull out only the failing items.",
  hints: ["kube-bench runs as a Job; the master checks need the control-plane paths mounted on the node.", "--json makes the output filterable but you must read the logs of the Job it creates."],
  need: [
    { label: "a kube-bench workload started", re: "aquasec/kube-bench" },
    { label: "kubectl run or create job used", re: "(kubectl\\s+run|create\\s+job|apply\\s+-f)" },
    { label: "results read from the logs", re: "kubectl\\s+logs" },
    { label: "filter to FAIL", re: "FAIL" }
  ],
  avoid: [
    { label: "no privileged flag needed for this", re: "--privileged" },
    { label: "avoid an unpinned :latest image", re: "kube-bench:latest" }
  ],
  solution:
`kubectl run kube-bench --image=aquasec/kube-bench:master --restart=Never -- command=run --json
kubectl logs kube-bench | jq '.Results[] | {node_type, tests: [.tests[] | select(.status=="fail") | {test_number, test_desc, info}]}'`,
  why: "The info field of a failing check contains the exact remediation - read it before you hand-edit files. In a kind or managed cluster some checks report FAIL because the cluster was not built by kubeadm; say so in a written answer instead of chasing them."
},
{
  id: "d-encryption-config", kind: "yaml", domain: "microservices", difficulty: "medium", minutes: 5,
  title: "Encryption at rest for Secrets",
  prompt: "Write the EncryptionConfiguration that encrypts Secrets with aescbc using a 32-byte key read from a provider file, with identity last, and the two kube-apiserver command lines that wire it in.",
  hints: ["Provider order matters: the first provider is used for new writes, later ones are kept for reading.", "The file needs a hostPath volume mount so the API server container can read it."],
  need: [
    { label: "apiVersion apiserver.config.k8s.io/v1", re: "apiserver\\.config\\.k8s\\.io/v1" },
    { label: "kind: EncryptionConfiguration", re: "kind:\\s*EncryptionConfiguration" },
    { label: "aescbc provider", re: "aescbc" },
    { label: "secrets resource listed", re: "resources:\\s*\\[?\\s*-?\\s*secrets" },
    { label: "identity listed last", re: "identity.{0,10}$|providers:[^]{0,400}aescbc[^]{0,300}identity" },
    { label: "--encryption-provider-config flag", re: "--encryption-provider-config=\\S+" },
    { label: "hostPath volume so the container can read the file", re: "hostPath" }
  ],
  avoid: [
    { label: "identity must not be first", re: "providers:\\s*\\n?\\s*-\\s*identity|providers:\\s*\\[?\\s*identity" },
    { label: "provider file not world readable", re: "mode:\\s*06(44|66|77)" }
  ],
  solution:
`# /etc/kubernetes/encryption-provider.yaml
apiVersion: apiserver.config.k8s.io/v1
kind: EncryptionConfiguration
resources:
  - resources: [secrets]
    providers:
      - aescbc:
          keys:
            - name: key1
              secret: <BASE64_ENCODED_ENCRYPTION_KEY>
      - identity: {}
---
# kube-apiserver static pod
    - --encryption-provider-config=/etc/kubernetes/encryption-provider.yaml
---
    volumeMounts:
    - name: encryption-config
      mountPath: /etc/kubernetes/encryption-provider.yaml
      readOnly: true
  volumes:
  - name: encryption-config
    hostPath:
      path: /etc/kubernetes/encryption-provider.yaml
      type: File`,
  why: "The secret field is the base64 key itself: generate one on the node with head -c 32 /dev/urandom | base64 (see the lab harness for the Windows/WSL equivalent) and write the file so the API server can read it, chmod 600. Existing Secrets are only rewritten on their next write - rotate them deliberately."
},
{
  id: "d-encryption-verify", kind: "shell", domain: "microservices", difficulty: "hard", minutes: 4,
  title: "Prove a Secret is encrypted in etcd",
  prompt: "Read the stored bytes of Secret prod/payments-key straight from etcd and show the encryption provider prefix.",
  hints: ["The registry key layout is /registry/secrets/<namespace>/<name>.", "kubectl always shows you decrypted data - only etcd proves the stored form."],
  need: [
    { label: "etcdctl get used", re: "etcdctl\\s+get\\s+/registry/secrets/prod/payments-key" },
    { label: "print only the value", re: "--print-value-only" },
    { label: "TLS client flags present", re: "--cacert=\\S+.{0,120}--cert=\\S+.{0,120}--key=\\S+" },
    { label: "ETCDCTL_API=3", re: "ETCDCTL_API=3|--command-api|api-v3" }
  ],
  avoid: [
    { label: "kubectl cannot prove storage encryption", re: "kubectl\\s+get\\s+secret.{0,60}payments-key" },
    { label: "do not print the Secret into a shared log", re: ">\\s*/var/log/\\S+" }
  ],
  solution:
`export ETCDCTL_API=3   # etcdctl 3.5+ already defaults to v3; export it so the command works on older setups
kubectl exec -n kube-system etcd-CONTROL_PLANE_NODE -- \\
  etcdctl get /registry/secrets/prod/payments-key --print-value-only \\
  --cacert=/etc/kubernetes/pki/etcd/ca.crt \\
  --cert=/etc/kubernetes/pki/etcd/server.crt \\
  --key=/etc/kubernetes/pki/etcd/server.key | head -c 120`,
  why: "Look for the k8s:enc:aescbc:v1:key1 marker at the start of the value - that string is the proof the API server wrote ciphertext. A value starting with k8s:enc:secretbox or plain k8s: v1 without a provider marker means your provider order or your rewrite step is wrong. kubectl get secret -o jsonpath always hands you decrypted plaintext, so it proves nothing about what etcd actually stores."
},
{
  id: "d-encryption-rotate", kind: "shell", domain: "microservices", difficulty: "hard", minutes: 5,
  title: "Rotate the Secret encryption key without data loss",
  prompt: "Order the steps so that a new key takes over writes while objects encrypted under the old key stay readable, then everything is rewritten and the old key removed.",
  hints: ["New key first for writes, old key still listed for reads.", "Rewrite with kubectl replace over a JSON dump, then re-verify in etcd."],
  need: [
    { label: "encryption config edited", re: "encryption-provider" },
    { label: "API server restarted or manifest touched", re: "(mv\\s+/etc/kubernetes/manifests|kube-apiserver.{0,80}restart|static pod)" },
    { label: "all Secrets rewritten", re: "get\\s+secrets\\s+--all-namespaces\\s+-o\\s+json\\s*\\|\\s*kubectl\\s+replace\\s+-f\\s*-" },
    { label: "verification after the rewrite", re: "etcdctl\\s+get\\s+/registry/secrets" }
  ],
  avoid: [
    { label: "never delete the old key before the rewrite", re: "(remove|delete)[^]{0,80}key1[\\s\\S]{0,200}get\\s+secrets\\s+--all-namespaces" },
    { label: "do not wipe etcd to force re-encryption", re: "etcdctl\\s+del\\s+/registry" }
  ],
  solution:
`# 1. prepend the new key in encryption-provider.yaml (name: key2 first, key1 kept second), then:
systemctl restart kubelet   # the kubelet re-creates the kube-apiserver static pod
# 2. confirm the API server is healthy
kubectl get --raw /readyz
# 3. rewrite every Secret so it is re-encrypted under key2
kubectl get secrets --all-namespaces -o json | kubectl replace -f -
# 4. verify one object in etcd now names key2, then remove key1 from the config and restart again
kubectl exec -n kube-system etcd-NODE -- etcdctl get /registry/secrets/prod/payments-key --print-value-only --cacert=/etc/kubernetes/pki/etcd/ca.crt --cert=/etc/kubernetes/pki/etcd/server.crt --key=/etc/kubernetes/pki/etcd/server.key | head -c 120`,
  why: "Objects written under a key you removed become unreadable, which is a cluster-wide Secret outage. The order is: add, restart, rewrite, verify, remove - and the config file you edited must never contain the old key once reads are gone."
},

/* ================= System Hardening ================= */
{
  id: "d-hardened-pod", kind: "yaml", domain: "microservices", difficulty: "medium", minutes: 6,
  title: "A Pod that passes restricted and stays immutable",
  prompt: "Write a single-container Pod that satisfies the restricted Pod Security Standard and keeps a read-only root filesystem with a writable /tmp.",
  hints: ["restricted wants: non-root, allowPrivilegeEscalation false, capabilities drop ALL, seccomp RuntimeDefault.", "If the image declares no user, runAsNonRoot alone is not enough - add a numeric runAsUser."],
  need: [
    { label: "runAsNonRoot: true", re: "runAsNonRoot:\\s*true" },
    { label: "allowPrivilegeEscalation: false", re: "allowPrivilegeEscalation:\\s*false" },
    { label: "capabilities drop ALL", re: "capabilities:[^]{0,80}drop:[^]{0,40}ALL" },
    { label: "seccompProfile RuntimeDefault", re: "seccompProfile:[^]{0,40}type:\\s*RuntimeDefault" },
    { label: "readOnlyRootFilesystem: true", re: "readOnlyRootFilesystem:\\s*true" },
    { label: "emptyDir mounted at /tmp", re: "mountPath:\\s*/tmp.{0,200}emptyDir|emptyDir.{0,200}mountPath:\\s*/tmp" }
  ],
  avoid: [
    { label: "no privileged container", re: "privileged:\\s*true" },
    { label: "no hostPath or hostNetwork", re: "hostPath|hostNetwork:\\s*true" },
    { label: "not running as root", re: "runAsUser:\\s*0\\b" },
    { label: "mutable :latest tag", re: "image:\\s*\\S+:latest" }
  ],
  solution:
`apiVersion: v1
kind: Pod
metadata:
  name: hardened-api
  namespace: prod
spec:
  automountServiceAccountToken: false
  securityContext:
    runAsNonRoot: true
    runAsUser: 65532
    fsGroup: 65532
    seccompProfile:
      type: RuntimeDefault
  containers:
  - name: api
    image: registry.internal.local/app/api@sha256:REPLACE
    securityContext:
      allowPrivilegeEscalation: false
      readOnlyRootFilesystem: true
      capabilities:
        drop: ["ALL"]
    volumeMounts:
    - name: tmp
      mountPath: /tmp
  volumes:
  - name: tmp
    emptyDir: {}`,
  why: "Pod-level and container-level securityContext can coexist; the grader reads the container-level fields for allowPrivilegeEscalation and capabilities. Dry-run it against the enforced namespace: kubectl apply -f hardened.yaml --dry-run=server."
},
{
  id: "d-psa-label", kind: "shell", domain: "microservices", difficulty: "easy", minutes: 2,
  title: "Enforce restricted, audit staging",
  prompt: "Label namespace prod so non-compliant Pods are rejected, and label staging so they are audited and warned but still admitted.",
  hints: ["The three labels are enforce, audit and warn.", "Use --overwrite when you re-apply in a lab."],
  need: [
    { label: "kubectl label namespace", re: "kubectl\\s+label\\s+namespace" },
    { label: "enforce=restricted on prod", re: "namespace\\s+prod.{0,120}pod-security\\.kubernetes\\.io/enforce=restricted" },
    { label: "audit=restricted on staging", re: "namespace\\s+staging.{0,160}pod-security\\.kubernetes\\.io/audit=restricted" },
    { label: "warn=restricted on staging", re: "pod-security\\.kubernetes\\.io/warn=restricted" }
  ],
  avoid: [
    { label: "staging must not be enforced", re: "namespace\\s+staging.{0,60}enforce=" },
    { label: "do not target kube-system", re: "namespace\\s+kube-system" }
  ],
  solution:
`kubectl label namespace prod pod-security.kubernetes.io/enforce=restricted --overwrite
kubectl label namespace prod pod-security.kubernetes.io/audit=restricted pod-security.kubernetes.io/warn=restricted --overwrite
kubectl label namespace staging pod-security.kubernetes.io/audit=restricted pod-security.kubernetes.io/warn=restricted --overwrite`,
  why: "Then demonstrate enforcement with a deliberate violation: kubectl run bad --rm -n prod --image=busybox:1.36 --restart=Never --privileged -- sleep 1 → denied by PodSecurity. kubectl get events -n staging shows the audit warnings for the same Pod."
},
{
  id: "d-kyverno-disallow", kind: "yaml", domain: "microservices", difficulty: "medium", minutes: 6,
  title: "Kyverno ClusterPolicy that denies privileged containers",
  prompt: "Write a ClusterPolicy in Enforce mode that rejects any container whose securityContext sets privileged, excluding kube-system, kyverno and kube-public.",
  hints: ["Conditional anchors =(securityContext) and =(privileged) mean: only evaluate the value when the key exists.", "validationFailureAction: Enforce blocks; Audit only records."],
  need: [
    { label: "apiVersion kyverno.io/v1", re: "kyverno\\.io/v1" },
    { label: "kind: ClusterPolicy", re: "kind:\\s*ClusterPolicy" },
    { label: "validationFailureAction: Enforce", re: "validationFailureAction:\\s*Enforce" },
    { label: "matches Pod kind", re: "kinds:\\s*\\[?\\s*-?\\s*Pod" },
    { label: "pattern requires privileged to be false", re: "privileged.{0,4}:\\s*false" },
    { label: "conditional anchor used", re: "=\\(securityContext\\)|=\\(privileged\\)" },
    { label: "kube-system excluded", re: "exclude:[^]{0,120}kube-system" }
  ],
  avoid: [
    { label: "failurePolicy Ignore defeats the policy", re: "failurePolicy:\\s*Ignore" },
    { label: "Enforce mode not downgraded to Audit", re: "validationFailureAction:\\s*Audit" }
  ],
  solution:
`apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: no-privileged-pods
spec:
  validationFailureAction: Enforce
  background: false
  schemaValidation: true
  rules:
  - name: privileged-forbidden
    match:
      any:
      - resources:
          kinds: ["Pod"]
          operations: ["CREATE", "UPDATE"]
    exclude:
      namespaces: ["kube-system", "kube-public", "kyverno"]
    validate:
      message: "Privileged containers are not allowed."
      pattern:
        spec:
          =(containers):
          - =(securityContext):
              =(privileged): "false"`,
  why: "If your Kyverno build prefers the negation operator, =(privileged): \"?true\" denies the true value instead of requiring false - check which form your cluster accepts with kubectl apply -f bad-pod.yaml --dry-run=server and read Kyverno's policy-validation logs. Kyverno is not in every cluster: kubectl get crd | grep kyverno tells you whether to reach for it."
},
{
  id: "d-netpol-crossns", kind: "yaml", domain: "microservices", difficulty: "medium", minutes: 5,
  title: "One direction, one caller",
  prompt: "Write a NetworkPolicy in namespace payments that lets only Pods labelled tier=frontend in namespace web reach app=payments-api on TCP 8443 - and nothing else inbound.",
  hints: ["The policy lives in the receiving namespace.", "namespaceSelector and podSelector in the same entry are ANDed.", "Pair it with a default-deny in the same namespace."],
  need: [
    { label: "metadata.namespace payments", re: "namespace:\\s*payments" },
    { label: "targets app=payments-api", re: "podSelector:[^]{0,80}app:\\s*payments-api" },
    { label: "policyTypes Ingress", re: "policyTypes:\\s*\\[?\\s*-?\\s*Ingress" },
    { label: "namespaceSelector for web", re: "namespaceSelector:[^]{0,120}kubernetes\\.io/metadata\\.name:\\s*web" },
    { label: "frontend podSelector", re: "tier:\\s*frontend" },
    { label: "port 8443", re: "port:\\s*8443" }
  ],
  avoid: [
    { label: "no ipBlock 0.0.0.0/0", re: "0\\.0\\.0\\.0/0" },
    { label: "an empty namespaceSelector allows every namespace", re: "namespaceSelector:\\s*\\{\\s*\\}" }
  ],
  solution:
`apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: payments-ingress-from-web
  namespace: payments
spec:
  podSelector:
    matchLabels:
      app: payments-api
  policyTypes:
  - Ingress
  ingress:
  - from:
    - namespaceSelector:
        matchLabels:
          kubernetes.io/metadata.name: web
      podSelector:
        matchLabels:
          tier: frontend
    ports:
    - port: 8443
      protocol: TCP`,
  why: "The two mistakes examiners watch for: an empty namespaceSelector (allows all namespaces) and shipping an allow rule without the default-deny companion, which silently leaves every other caller admitted."
},
{
  id: "d-runtimeclass", kind: "yaml", domain: "microservices", difficulty: "medium", minutes: 4,
  title: "RuntimeClass for sandboxed tenants",
  prompt: "Write a RuntimeClass named sandboxed for handler gvisor, restricted to namespace multi-tenant and to nodes labelled sandbox=true, plus the Pod that requests it.",
  hints: ["handler must match a runtime configured in containerd or CRI-O.", "scheduling.nodeSelector plus allowed namespaces are the guard rails."],
  need: [
    { label: "apiVersion node.k8s.io/v1", re: "node\\.k8s\\.io/v1" },
    { label: "kind: RuntimeClass", re: "kind:\\s*RuntimeClass" },
    { label: "name: sandboxed", re: "name:\\s*sandboxed" },
    { label: "handler: gvisor", re: "handler:\\s*gvisor" },
    { label: "allowed namespaces limit multi-tenant", re: "allowed:[^]{0,80}namespaces:[^]{0,60}multi-tenant" },
    { label: "nodeSelector for sandbox nodes", re: "scheduling:[^]{0,120}nodeSelector:[^]{0,60}sandbox" },
    { label: "Pod sets runtimeClassName", re: "runtimeClassName:\\s*sandboxed" }
  ],
  avoid: [
    { label: "handler runc is the default runtime, not a sandbox", re: "handler:\\s*runc\\b" },
    { label: "do not schedule it onto control-plane nodes", re: "control-plane" }
  ],
  solution:
`apiVersion: node.k8s.io/v1
kind: RuntimeClass
metadata:
  name: sandboxed
handler: gvisor
allowed:
  namespaces: ["multi-tenant"]
scheduling:
  nodeSelector:
    sandbox: "true"
---
apiVersion: v1
kind: Pod
metadata:
  name: tenant-shell
  namespace: multi-tenant
spec:
  runtimeClassName: sandboxed
  containers:
  - name: app
    image: registry.internal.local/tenant/app@sha256:REPLACE`,
  why: "On a kind or Docker Desktop lab the runtime itself is usually missing, so the Pod fails with a RuntimeClass/handler error. The scored part is the RuntimeClass plus the containerd runtime handler configuration; the lab harness shows the config.toml shape without asking you to install gVisor."
},
{
  id: "d-apparmor", kind: "yaml", domain: "system-hardening", difficulty: "hard", minutes: 6,
  title: "Custom AppArmor profile plus the Pod that uses it",
  prompt: "Write a minimal AppArmor profile for /usr/local/bin/app that reads /var/lib/app, writes only /tmp, and denies writes to /etc and /proc, then the Pod that applies it as a Localhost profile.",
  hints: ["AppArmor is host-level: the profile must exist on the node and be loaded before the Pod starts.", "securityContext.appArmorProfile is the supported field."],
  need: [
    { label: "profile declaration", re: "profile\\s+\\S+\\s*\\(?" },
    { label: "base abstraction included", re: "include\\s+<abstractions/base>" },
    { label: "the binary executed", re: "/usr/local/bin/app\\s+(ix|px|Px)" },
    { label: "a deny rule present", re: "deny\\s+/" },
    { label: "/tmp writable", re: "/tmp/\\*\\*\\s+[rw]" },
    { label: "appArmorProfile type Localhost", re: "appArmorProfile:[^]{0,60}type:\\s*Localhost" },
    { label: "localhostProfile named", re: "localhostProfile:\\s*\\S+" }
  ],
  avoid: [
    { label: "the deprecated beta annotation", re: "container\\.apparmor\\.security\\.beta\\.kubernetes\\.io" },
    { label: "privileged true does not make AppArmor work", re: "privileged:\\s*true" },
    { label: "profile that allows everything writable", re: "file\\s+\\{\\s*\\}\\s*w\\b" }
  ],
  solution:
`# /etc/apparmor.d/app-api   - load on the node: apparmor_parser -r /etc/apparmor.d/app-api
#include <tunables/global>
profile app-api flags=(attach_disconnected,mediate_deleted) {
  #include <abstractions/base>
  network,
  capability,
  /usr/local/bin/app ix,
  /var/lib/app/** r,
  /tmp/** rw,
  deny /etc/** wklx,
  deny @{PROC}/** wklx,
}
---
apiVersion: v1
kind: Pod
metadata:
  name: app-api
  namespace: prod
spec:
  containers:
  - name: app
    image: registry.internal.local/app/api@sha256:REPLACE
    securityContext:
      appArmorProfile:
        type: Localhost
        localhostProfile: app-api`,
  why: "Check the node first: apparmor_status (aa-status) must show the profile enforce. If AppArmor is not enabled in the kernel, the Pod fails with 'apparmor profile ... not found' - that is a lab-harness answer, not a manifest answer."
},
{
  id: "d-seccomp-custom", kind: "yaml", domain: "system-hardening", difficulty: "hard", minutes: 6,
  title: "Custom seccomp profile on top of the runtime default",
  prompt: "Write a seccomp JSON profile that keeps the runtime default behaviour, allows io_uring_setup on top of it, and the Pod field that loads it from a node-local file named app-seccomp.json.",
  hints: ["A custom profile replaces the runtime default, so copy the base profile rather than starting empty.", "defaultAction SCMP_ACT_ERRNO with the base syscall list is the shape."],
  need: [
    { label: "defaultAction SCMP_ACT_ERRNO", re: "defaultAction:\\s*SCMP_ACT_ERRNO" },
    { label: "architectures declared", re: "architectures:\\s*\\[?\\s*-?\\s*(SCMP_ARCH_X86_64|SCMP_ARCH_X64)" },
    { label: "syscalls list present", re: "syscalls:\\s*\\[" },
    { label: "io_uring_setup added", re: "names:\\s*\\[?\\s*-?\\s*io_uring_setup" },
    { label: "action for the added syscall", re: "SCMP_ACT_ALLOW" },
    { label: "seccompProfile Localhost with localhostProfile", re: "seccompProfile:[^]{0,80}type:\\s*Localhost.{0,80}localhostProfile:\\s*app-seccomp\\.json" }
  ],
  avoid: [
    { label: "SCMP_ACT_ALLOW as default disables confinement", re: "defaultAction:\\s*SCMP_ACT_ALLOW" },
    { label: "an empty syscalls list is not a base profile", re: "syscalls:\\s*\\[\\s*\\]" }
  ],
  solution:
`# /var/lib/kubelet/seccomp/app-seccomp.json  (kubelet's localhost seccomp directory)
{
  "defaultAction": "SCMP_ACT_ERRNO",
  "architectures": ["SCMP_ARCH_X86_64", "SCMP_ARCH_X64", "SCMP_ARCH_X86"],
  "syscalls": [
    { "names": ["io_uring_setup", "io_uring_enter", "io_uring_register"], "action": "SCMP_ACT_ALLOW" }
  ]
}
---
apiVersion: v1
kind: Pod
metadata:
  name: app-seccomp
  namespace: prod
spec:
  containers:
  - name: app
    image: registry.internal.local/app/api@sha256:REPLACE
    securityContext:
      seccompProfile:
        type: Localhost
        localhostProfile: app-seccomp.json`,
  why: "The file must sit in the runtime's localhost profile directory (containerd's default base is under /var/lib/kubelet/seccomp). Extract the real base profile instead of writing one from memory: cat /usr/share/containers/seccomp.json or runc's default, then add your entries to that list."
},
{
  id: "d-external-leastpriv", kind: "shell", domain: "system-hardening", difficulty: "medium", minutes: 4,
  title: "Least privilege for the people and the machines",
  prompt: "Write the answer as commands plus one sentence: how you would limit a node identity in a cloud-managed cluster and how operators reach the API.",
  hints: ["Instance profiles beat static access keys.", "A private endpoint plus VPN or bastion beats a public API server.", "Per-identity short-lived kubeconfig beats one shared cluster-admin."],
  need: [
    { label: "mentions an instance profile or scoped role", re: "(instance.?profile|iam.?role|scoped)" },
    { label: "per node pool identity", re: "node.?pool" },
    { label: "private endpoint or VPN/bastion", re: "(vpn|bastion|private endpoint|internal endpoint)" },
    { label: "short-lived credential via kubectl create token or OIDC", re: "(create token|oidc|short.?lived)" },
    { label: "no static long-lived key", re: "^(?!.*(aws_access_key_id|long.?lived secret))" }
  ],
  avoid: [
    { label: "shared cluster-admin kubeconfig", re: "cluster-admin.{0,60}(shared|everyone|all operators)" },
    { label: "kubectl proxy on a public host", re: "kubectl proxy.{0,60}(public|0\\.0\\.0\\.0)" }
  ],
  solution:
`# per node pool, via the instance profile attached to the node role - no static keys on the host
# operators reach the API through VPN/bastion against a private endpoint, with per-identity tokens
kubectl create token ci-sa -n ci --audience=api.prod.internal --duration=3600s
# one role per node pool, scoped to exactly the actions the node needs (for example ec2:DescribeInstances and the log/metric write permissions)`,
  why: "Separate the identities: node role, CI role and operator identity are three different principals. A leaked CI credential must not be able to read node instance-profile credentials, and a leaked kubeconfig must not be cluster-admin."
},

/* ================= Supply Chain Security ================= */
{
  id: "d-kyverno-verifyimages", kind: "yaml", domain: "supply-chain", difficulty: "hard", minutes: 7,
  title: "Kyverno policy that requires a signed image",
  prompt: "Write a ClusterPolicy whose verifyImages rule admits images from registry.internal.local only with a keyless cosign signature from issuer https://token.actions.githubusercontent.com and subject https://github.com/ORG/REPO/.github/workflows/build.yml@refs/heads/main. Do not rewrite the image reference; enforce it.",
  hints: ["mutateImage: false keeps verification without rewriting the tag into a digest.", "imageVerificationPolicy and the exact attestor spelling change between Kyverno releases - check kubectl explain clusterpolicy.spec.rules.verifyImages.attestors on your cluster."],
  need: [
    { label: "verifyImages rule", re: "verifyImages:" },
    { label: "imageReferences covers the internal registry", re: "imageReferences:\\s*\\[?\\s*-?\\s*registry\\.internal\\.local/\\*\\*" },
    { label: "mutateImage: false", re: "mutateImage:\\s*false" },
    { label: "attestors with a keys entry", re: "attestors:[^]{0,120}entries:[^]{0,80}keys:" },
    { label: "issuer set", re: "issuer:\\s*https://token\\.actions\\.githubusercontent\\.com" },
    { label: "subject pinned to the workflow ref", re: "subject:\\s*https://github\\.com/ORG/REPO/\\.github/workflows/build\\.yml@refs/heads/main" }
  ],
  avoid: [
    { label: "failurePolicy Ignore defeats the gate", re: "failurePolicy:\\s*Ignore" },
    { label: "an issuer wildcard accepts any workload", re: "issuer:\\s*\\*\\*" }
  ],
  solution:
`apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: verify-signed-images
spec:
  validationFailureAction: Enforce
  rules:
  - name: images-must-be-signed
    match:
      any:
      - resources:
          kinds: ["Pod", "Deployment", "StatefulSet", "DaemonSet", "Job", "CronJob"]
    exclude:
      namespaces: ["kube-system", "kyverno"]
    verifyImages:
    - imageReferences: ["registry.internal.local/**"]
      mutateImage: false
      attestors:
      - entries:
        - keys:
            issuer: "https://token.actions.githubusercontent.com"
            subject: "https://github.com/ORG/REPO/.github/workflows/build.yml@refs/heads/main"
            # keyful alternative to issuer/subject:
            # publicKeys: |-
            #   -----BEGIN PUBLIC KEY-----
            #   ...cosign public-key output...
            #   -----END PUBLIC KEY-----`,
  why: "kubectl explain clusterpolicy.spec.rules.verifyImages before you commit to field names - Kyverno has moved attestor and imageVerificationPolicy spelling between releases. Prove it with an unsigned image: kubectl run unsigned --rm -i --image=registry.internal.local/app/api:1.4.2 --restart=Never -- true"
},
{
  id: "d-dockerfile", kind: "dockerfile", domain: "supply-chain", difficulty: "medium", minutes: 6,
  title: "Minimal, non-root, reproducible image",
  prompt: "Write a Dockerfile for a Go service: build in the first stage, run in a digest-pinned distroless nonroot final stage, as a numeric non-root user, with no shell entrypoint.",
  hints: ["The final stage copies only the artifact, plus the CA bundle if the app makes HTTPS calls.", "CGO_ENABLED=0 gives a static binary; USER 65532:65532 matches distroless nonroot."],
  need: [
    { label: "two FROM stages", re: "FROM.{0,600}FROM" },
    { label: "COPY --from used", re: "COPY\\s+--from" },
    { label: "final stage is distroless or scratch", re: "FROM\\s*(?!.*latest)\\S*(distroless|scratch)" },
    { label: "numeric USER", re: "USER\\s+\\d+(:\\d+)?" },
    { label: "static build", re: "CGO_ENABLED=0" },
    { label: "exec-form ENTRYPOINT", re: "ENTRYPOINT\\s*\\[" }
  ],
  avoid: [
    { label: "no :latest base", re: "FROM\\s*\\S+:latest" },
    { label: "no shell entrypoint", re: "ENTRYPOINT\\s*\\[?\\s*\"?(/bin/sh|/bin/bash|sh -c)" },
    { label: "final stage must not run as root", re: "USER\\s+root" }
  ],
  solution:
`# build
FROM golang:1.23 AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux GOFLAGS=-trimpath go build -ldflags="-s -w" -o /out/api ./cmd/api

# runtime
FROM gcr.io/distroless/static-nonroot:nonroot AS runtime
COPY --from=build /out/api /api
COPY --from=build /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/
USER 65532:65532
ENTRYPOINT ["/api"]`,
  why: "Pin the build stage by digest as well when the task asks for reproducibility. Evidence for a reviewer: docker history --no-trunc IMG, then docker run --rm --entrypoint ls IMG -la / which shows no shell and no tools - that is how you prove the compiler never shipped."
},
{
  id: "d-minimal-pod-footprint", kind: "shell", domain: "supply-chain", difficulty: "medium", minutes: 3,
  title: "Prove the running image is minimal",
  prompt: "Show, for a running Pod, which image digest it uses and how many packages that image contains.",
  hints: ["A running container has no shell in a distroless image - inspect the image, not the container.", "syft produces the SBOM; the package count is the footprint number."],
  need: [
    { label: "reads the pod image reference", re: "kubectl\\s+get\\s+pod.{0,120}imageID|jsonpath=\\{?\\.status\\.containerStatuses" },
    { label: "image digest reported", re: "@sha256:" },
    { label: "syft SBOM used", re: "syft\\s+(packages|sbom|scan|dir:|image:)" },
    { label: "package count reported", re: "(wc -l|jq -r .(artifacts|name)|Measure-Object|count|length)" }
  ],
  avoid: [
    { label: "no host shell into the container", re: "kubectl\\s+exec.{0,60}/bin/(sh|bash)" }
  ],
  solution:
`kubectl get pod hardened-api -n prod -o jsonpath='{.status.containerStatuses[0].imageID}{"\n"}'
syft packages registry.internal.local/app/api@sha256:REPLACE -o table | tail -20
syft sbom registry.internal.local/app/api@sha256:REPLACE -o cyclonedx-json > out/app-api.cdx.json
jq '.components | length' out/app-api.cdx.json`,
  why: "A distroless answer needs numbers, not adjectives: no shell, no package manager, no compiler, and a package count of a handful. syft on the digest is what you keep as the artifact next to the signature."
},
{
  id: "d-trivy-gate", kind: "shell", domain: "supply-chain", difficulty: "easy", minutes: 3,
  title: "CVE gate that fails the pipeline",
  prompt: "One trivy command that fails a CI job on HIGH or CRITICAL vulnerabilities that have a fix available, for an image you just built.",
  hints: ["--exit-code 1 turns findings into a non-zero status.", "--ignore-unfixed means 'block only what I can actually patch' - name that tradeoff."],
  need: [
    { label: "trivy image", re: "trivy\\s+image" },
    { label: "severity HIGH,CRITICAL", re: "--severity[=\\s]+HIGH,\\s*CRITICAL" },
    { label: "--exit-code 1", re: "--exit-code[=\\s]+1" },
    { label: "--ignore-unfixed", re: "--ignore-unfixed" }
  ],
  avoid: [
    { label: "a gate that never fails", re: "--exit-code[=\\s]+0" },
    { label: "gating on a mutable :latest tag", re: "trivy\\s+image.{0,120}:latest" }
  ],
  solution:
`trivy image --severity HIGH,CRITICAL --exit-code 1 --ignore-unfixed registry.internal.local/app/api:1.4.2
# and after pushing, gate on the digest that the manifest actually references
trivy image --severity HIGH,CRITICAL --exit-code 1 --ignore-unfixed registry.internal.local/app/api@sha256:REPLACE
# find which running workloads carry the same image
trivy k8s --all-namespaces --include-cluster-rbac=false --severity HIGH,CRITICAL`,
  why: "State the tradeoff in writing: --ignore-unfixed keeps the pipeline actionable but knowingly accepts unfixed CVEs. trivy k8s maps the finding back to the Deployment that is running the affected image today."
},
{
  id: "d-cosign", kind: "shell", domain: "supply-chain", difficulty: "hard", minutes: 5,
  title: "Sign and verify keylessly, by digest",
  prompt: "Give the sign command and the verify command for an image in your internal registry, where verification pins both the OIDC issuer and the workflow identity regexp.",
  hints: ["Always sign and verify the digest, never the tag.", "Recent cosign refuses to verify at all unless you name the trusted issuer and identity."],
  need: [
    { label: "cosign sign on a digest", re: "cosign\\s+sign\\s+--yes\\s+registry\\.internal\\.local/app/api@sha256:" },
    { label: "cosign verify on the same digest", re: "cosign\\s+verify[^]{0,300}registry\\.internal\\.local/app/api@sha256:" },
    { label: "--certificate-identity-regexp", re: "--certificate-identity-regexp" },
    { label: "issuer pinned", re: "--certificate-oidc-issuer=\\s*https://token\\.actions\\.githubusercontent\\.com|https://token\\.actions\\.githubusercontent\\.com" }
  ],
  avoid: [
    { label: "signing a bare tag", re: "cosign\\s+sign[^]{0,80}\\S+:1\\.4\\.2\\b" },
    { label: "verify with no identity constraint", re: "cosign\\s+verify\\s+(?!.*--certificate-identity)(?!.*--annotations)[^]{0,200}@sha256:" }
  ],
  solution:
`IMG=registry.internal.local/app/api:1.4.2
docker push $IMG
DIGEST=$(docker inspect --format='{{index .RepoDigests 0}}' $IMG)
# sign and verify the digest reference, never the tag
cosign sign --yes registry.internal.local/app/api@sha256:REPLACE

cosign verify \\
  --certificate-oidc-issuer https://token.actions.githubusercontent.com \\
  --certificate-identity-regexp '^https://github.com/ORG/REPO/\\.github/workflows/build\\.yml@refs/heads/main$' \\
  registry.internal.local/app/api@sha256:REPLACE`,
  why: "cosign verify --annotations shows the payload; cosign public-key is the keyful flow only. If the image is copied to another registry, use cosign copy so the signature and attestations travel with the artifact - a plain retag does not carry them."
},
{
  id: "d-registry-secret", kind: "shell", domain: "supply-chain", difficulty: "medium", minutes: 4,
  title: "Private registry pull path for a whole namespace",
  prompt: "Create the docker-registry Secret regcred and make every Pod in namespace app use it without editing any workload manifest.",
  hints: ["kubectl create secret docker-registry with --docker-server/--docker-username/--docker-password.", "Patch the namespace's default ServiceAccount with imagePullSecrets."],
  need: [
    { label: "create secret docker-registry regcred", re: "create\\s+secret\\s+docker-registry\\s+regcred" },
    { label: "--docker-server set", re: "--docker-server=registry\\.internal\\.local" },
    { label: "credentials from environment variables", re: "--docker-password=\\$\\{?REG_PASS" },
    { label: "Secret created in namespace app", re: "-n\\s+app|--namespace=app" },
    { label: "patch the default serviceaccount", re: "patch\\s+serviceaccount\\s+default" },
    { label: "imagePullSecrets in the patch", re: "imagePullSecrets" }
  ],
  avoid: [
    { label: "no password literal on the command line", re: "--docker-password=[A-Za-z0-9]{6,}" },
    { label: "no anonymous read of the private registry", re: "(anonymous|public)\\s+pull" }
  ],
  solution:
`kubectl create secret docker-registry regcred -n app \\
  --docker-server=registry.internal.local \\
  --docker-username="$REG_USER" --docker-password="$REG_PASS"
kubectl patch serviceaccount default -n app -p '{"imagePullSecrets":[{"name":"regcred"}]}'`,
  why: "Test it with a Pod that references the private image by digest. Note the gotcha in your answer: a Pod that lists its own imagePullSecrets replaces the ServiceAccount list rather than extending it, so that Pod needs regcred named explicitly."
},
{
  id: "d-static-analysis", kind: "shell", domain: "supply-chain", difficulty: "medium", minutes: 4,
  title: "Gate your manifests before apply",
  prompt: "Four commands: lint your manifests, risk-score one manifest, apply your own Rego policy to them, and produce the image SBOM.",
  hints: ["kubelinter lint, kubesec scan, conftest test with a policy directory, syft for the SBOM.", "Name which tool gates the build and which one gates the manifest."],
  need: [
    { label: "kubelinter lint", re: "kubelinter\\s+lint\\s+\\S+" },
    { label: "kubesec scan", re: "kubesec\\s+scan\\s+\\S+" },
    { label: "conftest test with a policy dir", re: "conftest\\s+test\\s+[^]*--policy=\\S+|conftest\\s+test\\s+--policy\\s+\\S+" },
    { label: "syft SBOM", re: "syft\\s+(sbom|packages)\\s+\\S+" }
  ],
  avoid: [
    { label: "kube-bench is not manifest analysis", re: "kube-bench" },
    { label: "do not gate on a mutable tag", re: "kubelinter\\s+lint\\s+\\S+:latest" }
  ],
  solution:
`kubelinter lint manifests/
kubesec scan manifests/api-deployment.yaml | jq '.[0].risk'
conftest test manifests/ --policy=policy/
syft sbom registry.internal.local/app/api@sha256:REPLACE -o spdx-json > out/api.spdx.json`,
  why: "Map tool to target in your answer: KubeLinter lints manifest correctness, Kubesec risk-scores manifest choices like privileged and hostPath, Conftest runs your own Rego rules over manifests, Trivy/Grype match CVEs against the SBOM syft produces."
},
{
  id: "d-imagepolicy", kind: "yaml", domain: "supply-chain", difficulty: "hard", minutes: 7,
  title: "ImagePolicyWebhook wiring",
  prompt: "Write the AdmissionConfiguration that points ImagePolicyWebhook at a policy service kubeconfig for Pod creation, in Audit mode, and the kube-apiserver command lines that enable the plugin.",
  hints: ["--admission-control-config-file names the AdmissionConfiguration file.", "pathResolutions decides which API requests are sent to the webhook - /registry/pods for Pod creation.", "Field spelling for this plugin changes between releases; confirm on your cluster."],
  need: [
    { label: "apiserver.config.k8s.io apiVersion", re: "apiserver\\.config\\.k8s\\.io" },
    { label: "kind: AdmissionConfiguration", re: "kind:\\s*AdmissionConfiguration" },
    { label: "plugin named ImagePolicyWebhook", re: "name:\\s*ImagePolicyWebhook" },
    { label: "kubeConfigFile set", re: "kubeConfigFile:\\s*\\S+" },
    { label: "pathResolutions for pods", re: "pathResolutions:[^]{0,120}pathPrefix:\\s*/registry/pods" },
    { label: "allowOnFailure: false", re: "allowOnFailure:\\s*false" },
    { label: "--enable-admission-plugins includes ImagePolicyWebhook", re: "--enable-admission-plugins=\\S*ImagePolicyWebhook" },
    { label: "--admission-control-config-file flag", re: "--admission-control-config-file=\\S+" }
  ],
  avoid: [
    { label: "allowOnFailure true means an unreachable webhook admits everything", re: "allowOnFailure:\\s*true" },
    { label: "config path must be a file, not a directory", re: "--admission-control-config-file=\\S*/\\s" }
  ],
  solution:
`# /etc/kubernetes/image-policy-config.yaml
apiVersion: apiserver.config.k8s.io/v1alpha1
kind: AdmissionConfiguration
plugins:
  - name: ImagePolicyWebhook
    configuration:
      imagePolicy:
        kubeConfigFile: /etc/kubernetes/imagepolicy.kubeconfig
        allowOnFailure: false
        kind: ["Pod"]
        pathResolutions:
          - pathPrefix: "/registry/pods"
            resources: ["pods"]
---
# kube-apiserver static pod command
    - --enable-admission-plugins=NodeRestriction,ImagePolicyWebhook
    - --admission-control-config-file=/etc/kubernetes/image-policy-config.yaml`,
  why: "Confirm which fields your cluster version serves before shipping it - a bad admission config file stops the API server from starting, which turns a hardening task into an outage. In a lab cluster Kyverno verifyImages is usually the faster, safer route; state that in your answer."
},

/* ================= Monitoring, Logging and Runtime Security ================= */
{
  id: "d-falco-rule", kind: "yaml", domain: "runtime-security", difficulty: "medium", minutes: 6,
  title: "Falco rule: shell inside an application container",
  prompt: "Write a Falco list and macro, plus a rule that alerts when a shell is spawned inside Pods in namespace app running image registry.internal.local/app, naming pod, namespace, image and command in the output.",
  hints: ["Macros and lists make the rule reusable and are the idiomatic Falco style.", "Validate inside the Falco Pod before you rely on it."],
  need: [
    { label: "list defined", re: "-\\s*list:\\s*\\S+" },
    { label: "macro defined", re: "-\\s*macro:\\s*\\S+" },
    { label: "rule defined", re: "-\\s*rule:" },
    { label: "k8s.ns.name used", re: "k8s\\.ns\\.name" },
    { label: "container.image.repository used", re: "container\\.image\\.repository" },
    { label: "process field used", re: "proc\\.(pname|cmdline|exe)" },
    { label: "priority set", re: "priority:\\s*(Critical|Error|Warning|Notice|Info|Debug|Emergency)" },
    { label: "output names pod, ns, image and cmd", re: "output:[^]{0,400}k8s\\.pod\\.name.{0,120}k8s\\.ns\\.name.{0,160}container\\.image\\.repository.{0,160}proc\\.cmdline" }
  ],
  avoid: [
    { label: "a rule with no priority is not alertable", re: "^(?!.*priority:).*$" },
    { label: "the %DROP% shorthand is version-sensitive", re: "%DROP%" }
  ],
  solution:
`# /etc/falco/falco_rules.local.yaml
- list: app_images
  items: [registry.internal.local/app]

- macro: in_app_ns
  condition: >
    k8s.ns.name = app and container.image.repository in (app_images)

- rule: Shell in application container
  desc: A shell was spawned inside an application container.
  condition: >
    spawned_process and proc.pname in (sh, bash, dash) and in_app_ns
  output: >
    Shell in app container (user=%user.name pod=%k8s.pod.name ns=%k8s.ns.name
    image=%container.image.repository:%container.image.tag cmd=%proc.cmdline ppid=%proc.ppid)
  priority: WARNING
  tags: [process, app, cks]`,
  why: "Validate then trigger: kubectl exec -n falco FALCO_POD -- falco --validate /etc/falco/falco_rules.local.yaml (fall back to falco --help for your version's spelling), then kubectl exec -it APP_POD -- sh and read the DaemonSet logs. Falco also reads falco_rules.local.yaml automatically - put overrides there, never in falco_rules.yaml."
},
{
  id: "d-falco-tuning", kind: "shell", domain: "runtime-security", difficulty: "medium", minutes: 4,
  title: "Silence a noisy rule without losing coverage",
  prompt: "Show how you would see which rule is firing, list the rules Falco actually loaded, and then override one shipped rule in the local rules file.",
  hints: ["falco --list-rules and -o output formatting show the live rule set.", "Overrides belong in falco_rules.local.yaml or the chart's custom_rules.", "Re-scope with a macro or list instead of deleting the rule."],
  need: [
    { label: "list loaded rules", re: "falco\\s+--list-rules" },
    { label: "read falco alerts from the pod", re: "kubectl\\s+logs.{0,80}falco" },
    { label: "override file named falco_rules.local.yaml", re: "falco_rules\\.local\\.yaml" },
    { label: "rule overridden by name with a new condition", re: "-\\s*rule:\\s+.{0,80}condition:" }
  ],
  avoid: [
    { label: "do not raise every rule to Emergency", re: "priority:\\s*Emergency" },
    { label: "disabling the collector is not tuning", re: "enabled:\\s*false" }
  ],
  solution:
`kubectl logs -n falco daemonset/falco | grep -m5 -i 'Warning|Error' # which rules are firing
kubectl exec -n falco FALCO_POD -- falco --list-rules | grep -i 'shell'
# /etc/falco/falco_rules.local.yaml  (or the chart values custom_rules entry)
- rule: Terminal shell in container
  condition: >
    spawned_process and proc.name in (sh, bash) and not in_app_ns`,
  why: "Two legitimate tuning moves: re-scope the rule with a macro/list so it only covers your workloads, or override the shipped rule by name in the local rules file. Raising priorities to Emergency or switching the collector off both destroy the signal you were hired to watch."
},
{
  id: "d-audit-policy", kind: "yaml", domain: "runtime-security", difficulty: "hard", minutes: 6,
  title: "Audit policy that records the important things",
  prompt: "Write an audit policy: RBAC changes and Secret access at RequestResponse, pods/exec at RequestResponse, Pod writes at Metadata, everything else cheaply at Metadata, and kube-system service accounts not logged for reads.",
  hints: ["Audit policy evaluation is ordered: the first matching rule wins.", "omitStages RequestReceived removes the duplicate receive stage.", "A trailing rule with no verbs/resources filter is the catch-all."],
  need: [
    { label: "apiVersion audit.k8s.io/v1", re: "apiVersion:\\s*audit\\.k8s\\.io/v1" },
    { label: "kind: Policy", re: "kind:\\s*Policy" },
    { label: "secrets at RequestResponse", re: "secrets.{0,200}RequestResponse|RequestResponse.{0,200}secrets" },
    { label: "rbac resources covered", re: "clusterrolebindings|rolebindings" },
    { label: "pods/exec covered", re: "pods/exec" },
    { label: "omitStages used", re: "omitStages" },
    { label: "a Metadata rule present", re: "level:\\s*Metadata" },
    { label: "kube-system SA rule scoped by users", re: "users:[^]{0,80}system:serviceaccount:kube-system" }
  ],
  avoid: [
    { label: "wildcard verbs", re: "verbs:\\s*\\[?\\s*-?\\s*\\*" },
    { label: "wildcard resources", re: "resources:\\s*\\[?\\s*-?\\s*\\*" }
  ],
  solution:
`apiVersion: audit.k8s.io/v1
kind: Policy
rules:
  - level: RequestResponse
    verbs: ["create", "update", "patch", "delete"]
    resources:
      - group: "rbac.authorization.k8s.io"
        resources: ["clusterroles", "clusterrolebindings", "roles", "rolebindings"]

  - level: RequestResponse
    verbs: ["get", "list", "watch", "create", "update", "patch", "delete"]
    resources:
      - group: ""
        resources: ["secrets"]

  - level: RequestResponse
    verbs: ["create", "get"]
    resources:
      - group: ""
        resources: ["pods/exec", "pods/attach", "pods/portforward", "pods/proxy"]

  - level: Metadata
    verbs: ["create", "delete", "patch", "update"]
    resources:
      - group: "apps"
        resources: ["deployments", "daemonsets", "statefulsets", "replicasets"]
      - group: ""
        resources: ["pods", "serviceaccounts", "configmaps"]

  - level: None
    users: ["system:serviceaccount:kube-system:*"]
    verbs: ["get", "list", "watch"]

  - level: Metadata
    omitStages: ["RequestReceived"]`,
  why: "The graded part is the order: put a Metadata catch-all first and the Secret rule is never reached, so your log has no bodies when a grader asks 'show me what was written'. Apply it and confirm with the jq drill."
},
{
  id: "d-audit-jq", kind: "shell", domain: "runtime-security", difficulty: "medium", minutes: 4,
  title: "Answer who did what from the audit log",
  prompt: "Two jq pipelines over the API server audit log: one lists Pod creations with actor, namespace and source IP; the other lists Secret reads with actor, namespace and Secret name. Plus one that finds who got a shell in a Pod.",
  hints: ["Audit events are one JSON object per line.", "objectRef carries resource, subresource, namespace and name.", "user.username is empty for node-authenticated requests - name that when you read the output."],
  need: [
    { label: "jq used", re: "jq" },
    { label: "select on verb and resource", re: "select\\([^]{0,120}verb.{0,80}objectRef\\.resource" },
    { label: "pods creations query", re: "objectRef\\.resource=+pods" },
    { label: "user.username reported", re: "user\\.username" },
    { label: "secrets query", re: "objectRef\\.resource=+secrets" },
    { label: "subresource exec query", re: "objectRef\\.subresource=+exec" }
  ],
  avoid: [
    { label: "do not dump the whole log to the terminal", re: "^cat\\s+\\S*audit\\.log\\s*$" },
    { label: "kubectl events are not the audit log", re: "get\\s+events.{0,80}audit" }
  ],
  solution:
`AUDIT=/var/log/kubernetes/audit.log

jq -c 'select(.verb=="create" and .objectRef.resource=="pods")
       | {ts: .requestReceivedTimestamp, user: .user.username, ip: .sourceIPs,
          ns: .objectRef.namespace, name: .objectRef.name}' "$AUDIT"

jq -c 'select(.objectRef.resource=="secrets" and (.verb=="get" or .verb=="list"))
       | {ts: .requestReceivedTimestamp, user: .user.username, code: .responseCode,
          ns: .objectRef.namespace, name: .objectRef.name}' "$AUDIT"

jq -r 'select(.objectRef.subresource=="exec")
       | [.requestReceivedTimestamp, .user.username, .objectRef.namespace, .objectRef.name, .verb] | @tsv' "$AUDIT"`,
  why: "Read the output out loud in your answer: 'these four users created Pods in prod, two of them from the CI subnet, and one Secret was read by a ServiceAccount that has no business reading it.' A CKS answer is a conclusion, not only a command."
},
{
  id: "d-debug-node", kind: "shell", domain: "runtime-security", difficulty: "medium", minutes: 3,
  title: "Inspect a node through the API",
  prompt: "Open a shell on node node1 through the API, chroot into the host filesystem, then list listening sockets and processes.",
  hints: ["kubectl debug node/NAME creates an ephemeral debug container that is removed when you exit.", "The node debug container mounts the host filesystem at /host."],
  need: [
    { label: "kubectl debug node/node1", re: "debug\\s+node/node1" },
    { label: "-it", re: "-it" },
    { label: "explicit pinned image", re: "--image=busybox:1\\.36" },
    { label: "chroot /host", re: "chroot\\s+/host" }
  ],
  avoid: [
    { label: "do not debug with the compromised image", re: "--image=\\S*(attacker|malware|bad)" },
    { label: "not a hand-written hostPath Pod", re: "hostPath" }
  ],
  solution:
`kubectl debug node/node1 -it --image=busybox:1.36 -- chroot /host sh -c 'ss -tnp | head -30; ps auxf | head -40'`,
  why: "The debug container is ephemeral, which is what makes it safe on a control-plane node. For evidence, follow with kubectl cp from the captured copy - never edit files in place on a node you may have to testify about."
},
{
  id: "d-containment", kind: "shell", domain: "runtime-security", difficulty: "hard", minutes: 5,
  title: "Contain a compromised Deployment, keep the evidence",
  prompt: "Order the commands so that deployment payments-api in namespace prod is cut off from the network, its logs and files are captured, and only then is it stopped - and the node fenced.",
  hints: ["NetworkPolicy first, evidence second, scale to zero third, cordon last.", "Scale to zero keeps the spec, ownerRefs and audit trail that deleting destroys."],
  need: [
    { label: "NetworkPolicy applied first", re: "apply\\s+-f\\s+\\S*net\\S*.{0,300}kubectl\\s+logs" },
    { label: "logs captured", re: "logs\\s+deployment/payments-api\\s+-n\\s+prod|logs.{0,80}payments-api" },
    { label: "file copied out with kubectl cp", re: "kubectl\\s+cp\\s+prod/" },
    { label: "scaled to zero", re: "scale\\s+deployment\\s+payments-api[^]{0,60}--replicas=0" },
    { label: "node cordoned", re: "cordon\\s+node" }
  ],
  avoid: [
    { label: "deleting the workload before capturing", re: "delete\\s+deployment\\s+payments-api[\\s\\S]{0,300}kubectl\\s+logs" },
    { label: "draining before cordoning", re: "drain[\\s\\S]{0,120}cordon" },
    { label: "deleting the namespace is not containment", re: "delete\\s+namespace\\s+prod" }
  ],
  solution:
`# 1. cut the network first (deny egress, keep DNS)
kubectl apply -f containment/prod-netpol-deny-egress.yaml
# 2. capture evidence
kubectl logs deployment/payments-api -n prod --all-containers --prefix --timestamps > evidence/payments-api.logs
kubectl cp prod/POD_NAME:/var/log/app evidence/app-logs -c app
kubectl get pod,deploy,rs,sa,rolebinding,netpol,cronjob,daemonset -n prod -o yaml > evidence/prod-objects.yaml
# 3. stop it, do not delete it
kubectl scale deployment payments-api -n prod --replicas=0
# 4. fence the node - no eviction until the evidence is captured
kubectl cordon node2
kubectl get events -n prod --sort-by=.lastTimestamp | tail -30`,
  why: "Then hunt persistence before you call it closed: kubectl get cronjobs,daemonsets,deployments -A -o wide, the cluster-admin binding query, kubectl get mutatingwebhookconfigurations,validatingwebhookconfigurations, and the static pod manifests on the node."
},
{
  id: "d-hunt-persistence", kind: "shell", domain: "runtime-security", difficulty: "hard", minutes: 5,
  title: "Find how the workload keeps coming back",
  prompt: "Give the sweep commands that reveal what is re-creating the Pod and what privileged path the attacker left behind: controllers, RBAC grants, webhook registrations, and suspicious workload fields.",
  hints: ["Reappearance means an owner object still exists.", "Privilege grants are the persistence: new RoleBindings, hostPath mounts, hostPID, privileged containers.", "Webhook registrations are stealthy persistence."],
  need: [
    { label: "controllers listed cluster-wide", re: "get\\s+(cronjobs?,daemonsets?,deployments?)[^]{0,120}-A" },
    { label: "clusterrolebindings checked", re: "clusterrolebindings?" },
    { label: "hostPath/privileged sweep", re: "(hostPath|privileged)" },
    { label: "jsonpath or jq used for the sweep", re: "(jsonpath|jq|-o json)" },
    { label: "webhook configurations listed", re: "webhookconfigurations" }
  ],
  avoid: [
    { label: "a single-namespace sweep is not cluster-wide", re: "^kubectl\\s+get\\s+deployments\\s+-n\\s+prod\\s*$" },
    { label: "do not delete first", re: "delete\\s+deployment.{0,80}before" }
  ],
  solution:
`kubectl get cronjobs,daemonsets,deployments,statefulsets -A -o wide
kubectl get clusterrolebindings,rolebindings -A -o json | jq -r '.items[] | select(.subjects[]?.kind=="ServiceAccount") | [.metadata.namespace, .metadata.name, .roleRef.name] | @tsv'
kubectl get pods -A -o json | jq -r '.items[] | select((.spec.hostPath//[] | length)>0 or .spec.hostPID or .spec.hostNetwork or any(.spec.containers[]?; .securityContext.privileged==true)) | [.metadata.namespace, .metadata.name] | @tsv'
kubectl get mutatingwebhookconfigurations,validatingwebhookconfigurations
kubectl get pods -n kube-system -o custom-columns=NAME:.metadata.name,HOSTPATH:.spec.volumes[*].hostPath.path`,
  why: "Real Kubernetes persistence looks like: an owning controller, a new Role/ClusterRoleBinding for a workload ServiceAccount, a legacy SA token Secret, a static pod file on a node, or a new admission webhook. Say all five, then show the two you actually ran."
},
{
  id: "d-immutability-manifest", kind: "yaml", domain: "runtime-security", difficulty: "medium", minutes: 5,
  title: "Immutable workloads in a Deployment",
  prompt: "Write a Deployment whose Pods cannot be modified at runtime: digest-pinned image, read-only root, narrow writable mounts, dropped capabilities, no privilege escalation, non-root numeric user and seccomp.",
  hints: ["A digest reference plus imagePullPolicy: Always is rejected - use IfNotPresent or omit it.", "Every writable path needs an explicit emptyDir."],
  need: [
    { label: "kind: Deployment", re: "kind:\\s*Deployment" },
    { label: "image pinned by digest", re: "image:\\s*\\S+@sha256:" },
    { label: "imagePullPolicy IfNotPresent", re: "imagePullPolicy:\\s*IfNotPresent" },
    { label: "readOnlyRootFilesystem true", re: "readOnlyRootFilesystem:\\s*true" },
    { label: "emptyDir writable mount", re: "emptyDir" },
    { label: "capabilities drop ALL", re: "capabilities:[^]{0,80}drop:[^]{0,40}ALL" },
    { label: "allowPrivilegeEscalation false", re: "allowPrivilegeEscalation:\\s*false" },
    { label: "seccomp RuntimeDefault", re: "seccompProfile:[^]{0,40}type:\\s*RuntimeDefault" }
  ],
  avoid: [
    { label: "Always on a digest reference is rejected", re: "imagePullPolicy:\\s*Always[\\s\\S]{0,120}@sha256:" },
    { label: "no writable hostPath", re: "hostPath" },
    { label: "no :latest tag", re: ":latest" }
  ],
  solution:
`apiVersion: apps/v1
kind: Deployment
metadata:
  name: payments-api
  namespace: prod
spec:
  replicas: 2
  selector:
    matchLabels: { app: payments-api }
  template:
    metadata:
      labels: { app: payments-api }
    spec:
      automountServiceAccountToken: false
      securityContext:
        runAsNonRoot: true
        runAsUser: 65532
        fsGroup: 65532
        seccompProfile: { type: RuntimeDefault }
      containers:
      - name: api
        image: registry.internal.local/app/api@sha256:REPLACE
        imagePullPolicy: IfNotPresent
        securityContext:
          allowPrivilegeEscalation: false
          readOnlyRootFilesystem: true
          capabilities: { drop: ["ALL"] }
        volumeMounts:
        - { name: tmp, mountPath: /tmp }
      volumes:
      - { name: tmp, emptyDir: {} }`,
  why: "The immutability answer is a set of negatives: the container cannot write its own filesystem, cannot gain capabilities, cannot be replaced by a different image under the same reference, and has no shell to be handed to an attacker."
},
{
  id: "d-readonly-fix", kind: "shell", domain: "runtime-security", difficulty: "easy", minutes: 2,
  title: "The app crashed because the root filesystem is read-only",
  prompt: "Diagnose and fix it with commands plus the manifest change, without weakening the control.",
  hints: ["Read the crash log to find the exact path it tried to write.", "Mount a narrow emptyDir at that path."],
  need: [
    { label: "reads the container log", re: "kubectl\\s+logs\\s+\\S+.{0,80}(--previous|Read-only|EROFS|Permission denied)" },
    { label: "manifest edited", re: "(edit\\s+deployment|apply\\s+-f|patch\\s+deployment)" },
    { label: "emptyDir added", re: "emptyDir" },
    { label: "readOnlyRootFilesystem kept true", re: "readOnlyRootFilesystem.{0,60}true" }
  ],
  avoid: [
    { label: "do not remove the read-only filesystem", re: "readOnlyRootFilesystem:\\s*false" },
    { label: "do not mount the host root writable", re: "hostPath:\\s*path:\\s*/\\b" },
    { label: "do not run as root to make the write work", re: "runAsUser:\\s*0\\b" }
  ],
  solution:
`kubectl logs payments-api-POD -n prod --previous | grep -iE 'read-only|EROFS|permission denied'
kubectl patch deployment payments-api -n prod --type=strategic -p '{"spec":{"template":{"spec":{"containers":[{"name":"api","volumeMounts":[{"name":"tmp","mountPath":"/tmp"}]}],"volumes":[{"name":"tmp","emptyDir":{}}]}}}}'
kubectl rollout status deployment/payments-api -n prod
kubectl get deploy payments-api -n prod -o jsonpath='{.spec.template.spec.containers[0].securityContext.readOnlyRootFilesystem}'  # stays true`,
  why: "The answer to give out loud: immutable root plus explicit, ephemeral, narrow writable mounts. Removing readOnlyRootFilesystem or mounting a writable hostPath at / reintroduces exactly the tampering the control exists to prevent."
},
{
  id: "d-audit-enable", kind: "shell", domain: "runtime-security", difficulty: "medium", minutes: 4,
  title: "Turn audit logging on and confirm it is live",
  prompt: "Show where the policy file and flags go on a kubeadm control plane, restart the component the supported way, and prove events are landing.",
  hints: ["kube-apiserver is a static pod manifest in /etc/kubernetes/manifests.", "The file needs to be readable from inside the container, so a hostPath volume mount is part of the answer.", "Retention flags keep a busy cluster from filling the disk."],
  need: [
    { label: "audit policy file referenced", re: "--audit-policy-file=\\S+" },
    { label: "audit log path set", re: "--audit-log-path=\\S+" },
    { label: "retention flags", re: "--audit-log-maxage|--audit-log-maxbackup|--audit-log-maxsize" },
    { label: "static pod manifest edited", re: "/etc/kubernetes/manifests/kube-apiserver\\.yaml" },
    { label: "hostPath mount for the policy dir", re: "hostPath" },
    { label: "verification by generating and reading an event", re: "kubectl\\s+get\\s+secrets?.{0,200}(cat|tail|jq).{0,80}audit" }
  ],
  avoid: [
    { label: "do not restart the API server by killing it", re: "pkill\\s+kube-apiserver" },
    { label: "audit not disabled", re: "--audit-log-path=\\s*$" }
  ],
  solution:
`# on the control-plane node edit /etc/kubernetes/manifests/kube-apiserver.yaml and add under spec.containers[].command:
    - --audit-policy-file=/etc/kubernetes/audit-policy.yaml
    - --audit-log-path=/var/log/kubernetes/audit.log
    - --audit-log-maxage=30
    - --audit-log-maxbackup=10
    - --audit-log-maxsize=100
---
    volumeMounts:
    - { name: audit-policy, mountPath: /etc/kubernetes/audit-policy.yaml, readOnly: true }
    - { name: audit-logs, mountPath: /var/log/kubernetes }
  volumes:
  - { name: audit-policy, hostPath: { path: /etc/kubernetes/audit-policy.yaml, type: File } }
  - { name: audit-logs, hostPath: { path: /var/log/kubernetes, type: DirectoryOrCreate } }
---
# the kubelet notices the manifest change and re-creates the static pod
kubectl get pods -n kube-system | grep apiserver
kubectl get secrets -n prod >/dev/null 2>&1   # generate one audited request
ssh NODE 'tail -3 /var/log/kubernetes/audit.log | jq -c "{level, verb, user: .user.username, obj: .objectRef}"'`,
  why: "In the exam you may be told the file already exists and only the flags are missing. Check both directions: does the manifest reference the policy file, and does the file actually exist on the node with the path spelled the same inside the container."
},
{
  id: "d-runtime-evidence", kind: "shell", domain: "runtime-security", difficulty: "hard", minutes: 5,
  title: "Answer a runtime question with the right sensor",
  prompt: "For each of these questions, give the command: (a) what is running in the container right now, (b) what a process inside it executed, (c) which image a node is actually running, (d) what a Pod did to the network namespace.",
  hints: ["kubectl exec is your view into the Pod; crictl is your view into the runtime; Falco is your view into syscalls; Hubble/CNI is your view into flows.", "Name the plane each command reads."],
  need: [
    { label: "process view inside the container", re: "kubectl\\s+exec[^]{0,80}(ps|top)" },
    { label: "runtime view via crictl on the node", re: "crictl\\s+(ps|pods|inspect)" },
    { label: "Falco alerts read", re: "(falco|kubectl\\s+logs.{0,60}falco)" },
    { label: "flow view", re: "(hubble\\s+observe|kubectl\\s+logs.{0,80}cilium|ss -tnp)" }
  ],
  avoid: [
    { label: "kubectl logs is not process evidence", re: "kubectl\\s+logs.{0,60}executed\\s+command" },
    { label: "no privileged host-Pod hack instead of crictl", re: "--host-pid" }
  ],
  solution:
`# (a) what is running inside the container
kubectl exec -n prod POD -- ps -ef
# (b) what it executed - Falco events
kubectl logs -n falco daemonset/falco | tail -20
# (c) what image the node really has, and the container runtime view
ssh NODE 'crictl ps; crictl inspect CONTAINER_ID | jq "{image: .status.imageRef, startedAt: .status.startedAt}"'
# (d) flows in and out of the Pod
ssh NODE 'ss -tnp | grep POD_IP'   # or hubble observe --pod prod/POD_NAME when Cilium is installed`,
  why: "Say the plane out loud: Pod/spec state is kubectl, runtime state is crictl on the node, syscall behaviour is Falco, network flows are the CNI's own visibility, and user/API behaviour is the audit log. A CKS answer names the sensor before the command."
}
];
