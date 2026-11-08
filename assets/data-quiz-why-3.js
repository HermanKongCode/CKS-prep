/* CKS Prep - per-option rationales, System Hardening. Shown only after the learner submits an answer. */
window.CKS_QUIZ_WHY_3 = {
  "q-sh-1": [
    "Trimming the node image to the packages that role needs removes compilers and debug tools a foothold would reuse.",
    "Blacklisting unused kernel modules in /etc/modprobe.d closes code paths a privileged container could otherwise load.",
    "Binding sshd and node-exporter to a management interface, then firewalling it, removes them from the pod-facing network.",
    "PermitRootLogin with a password gives attackers a guessable credential for the most powerful account on the host.",
    "Rebuilding a minimal node image on a schedule replaces hand-applied drift with an auditable build and its patch state."
  ],
  "q-sh-2": [
    "An instance profile per node pool limits cloud API permissions to that pool, so a broken node cannot act beyond its role.",
    "One PowerUser role for all nodes turns any node compromise into broad write access across the whole cloud account.",
    "Static access keys in a Secret stay valid until you rotate them manually and are readable by anyone who can read that Secret.",
    "Giving CI the same role as the nodes lets a compromised build impersonate a node and use its instance-profile credentials."
  ],
  "q-sh-3": [
    "appArmorProfile with type Localhost names a profile file already loaded on the node, and the runtime applies it to that container.",
    "container.apparmor.security.beta.kubernetes.io is the deprecated beta path, superseded by the appArmorProfile securityContext field.",
    "seccompProfile type Localhost expects a JSON seccomp profile under the kubelet seccomp root, not an AppArmor profile file.",
    "AppArmor profiles are loaded per node with apparmor_parser and applied per Pod, so a DaemonSet is not a cluster-wide enforcement mode."
  ],
  "q-sh-4": [
    "RuntimeDefault makes the container runtime apply the default runc seccomp profile, which blocks unsafe syscalls with no custom file.",
    "capabilities drop ALL removes privileged operations, yet the container can still call the many syscalls the default profile allows.",
    "The restricted policy only requires each container to name a seccomp profile; confinement comes from that profile, not the label.",
    "privileged: false is already the default, so the container still runs under runc against the host kernel with unrestricted syscalls."
  ],
  "q-sh-5": [
    "A custom profile fully replaces the runtime default, so SCMP_ACT_ERRNO plus the copied base list plus one added entry keeps confinement.",
    "defaultAction SCMP_ACT_ALLOW with an empty syscalls list permits every syscall, which is functionally unconfined for that container.",
    "SCMP_ACT_KILL as the default action terminates the process on any syscall outside the single entry, so normal workloads cannot start.",
    "Capabilities are a separate kernel check; a seccomp JSON profile matches syscall numbers and argument ranges, not capability names."
  ],
  "q-sh-6": [
    "Keeping 6443 on a private endpoint reached over VPN or bastion removes the public listener, and short-lived credentials cap each identity.",
    "Anonymous auth on a public load balancer exposes discovery endpoints and whatever the anonymous group is granted, from the open internet.",
    "A shared cluster-admin kubeconfig gives every operator full write access, with no attribution and full-cluster revocation if it leaks.",
    "kubectl proxy forwards requests with the credentials of whoever runs it, so callers reaching that public port inherit them."
  ]
};
