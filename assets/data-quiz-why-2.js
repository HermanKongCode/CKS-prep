/* CKS Prep - per-option rationales, Cluster Hardening. Shown only after the learner submits an answer. */
window.CKS_QUIZ_WHY_2 = {
  "q-ch-1": [
    "Role and RoleBinding are namespaced objects, so the verbs apply only inside app and the binding can name the ServiceAccount living there.",
    "A ClusterRoleBinding applies its rules in every namespace, turning a single-namespace read into cluster-wide pods get, list and watch.",
    "A RoleBinding can bind a ServiceAccount from its own namespace, so using a ClusterRoleBinding here widens the grant beyond app for nothing.",
    "Aggregation merges labelled child ClusterRoles into one cluster-scoped role, which still grants pods access across all namespaces."
  ],
  "q-ch-2": [
    "RBAC escalation prevention blocks a RoleBinding unless the caller holds bind on that role, plus escalate for any raised rules.",
    "Namespace scope says where a resource lives, not who may bind roles, so escalation through a RoleBinding works inside one namespace.",
    "PodSecurity only validates Pod specifications, so it never inspects RoleBinding creation and cannot stop a permission grant.",
    "Anyone with create on clusterroles can author one; what the escalation guard checks is bind and escalate, not who wrote the role."
  ],
  "q-ch-3": [
    "A projected serviceAccountToken volume mints a token scoped to that Pod, to the audience you request, and to the expirationSeconds window.",
    "The default automounted token authenticates as the ServiceAccount cluster-wide, carries no audience binding and has no short lifetime.",
    "Legacy SA token Secrets hold a static credential valid cluster-wide until the Secret is deleted, with no audience and no expiry.",
    "kubectl create token does mint a bound token, but --decode only reads a token back and a kubeconfig still stores it as static text."
  ],
  "q-ch-4": [
    "On a kubeadm node the kubelet reads KubeletConfiguration here, so readOnlyPort: 0 and anonymousAuth: false close the endpoint.",
    "That manifest configures the kube-apiserver static pod, and the kubelet read-only port is not an apiserver setting in it.",
    "kubeadm starts the kubelet with --config, so the effective values come from the KubeletConfiguration file rather than unit-file flags.",
    "The kubelet-config ConfigMap in kube-system is the template kubeadm hands to new nodes; a running kubelet reads its local file instead."
  ],
  "q-ch-5": [
    "anonymousAuth: false rejects requests arriving as system:anonymous, so unauthenticated probes can no longer reach the kubelet API.",
    "readOnlyPort: 0 shuts down the plaintext 10255 endpoint that served paths such as /pods and /stats with no authentication.",
    "clientCAFile makes the kubelet verify client certificates against the cluster CA, authenticating clients such as the API server.",
    "AlwaysAllow skips the Webhook authorization call to the API server, so any authenticated caller receives every kubelet permission.",
    "A zero idle timeout never expires idle exec or attach streams, leaving established sessions open on the kubelet indefinitely."
  ],
  "q-ch-6": [
    "--as impersonates that ServiceAccount identity and --list runs the checks, so the output is the effective set after every binding.",
    "This prints the rules written in one Role but not which users or ServiceAccounts are bound to it, nor any cluster-wide bindings.",
    "describe reports the ServiceAccount name, its secrets and its mount setting; RBAC bindings are separate objects it never displays.",
    "ClusterRoles alone show cluster-scoped rules and omit the RoleBindings, aggregated members and subjects those rules actually reach."
  ],
  "q-ch-7": [
    "Version skew forbids a kubelet newer than the API server, so kubeadm upgrade apply plus its kubelet and kubectl come first, node by node.",
    "A kubelet newer than the API server it talks to violates the supported skew, which is exactly what updating kubelets first produces.",
    "A fresh kubeadm init replaces the cluster certificates and control-plane state that kubeadm upgrade is designed to preserve.",
    "Workers updated first end up with kubelets newer than the still-old API server, a skew the supported upgrade order does not allow."
  ],
  "q-ch-8": [
    "The API server encrypts Secret data with the configured provider before writing, so etcd stores ciphertext instead of base64 plaintext.",
    "quota-backend-bytes only caps the database size and raises a NOSPACE alarm when hit, leaving the stored content just as readable.",
    "The aggregator merges Extension apiservices into /apis; switching it off removes API surface but changes nothing stored in etcd.",
    "Annotations live in the workload object, readable by anyone with get on it, and are stored without provider encryption."
  ]
};
