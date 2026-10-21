# Single-Node Kubernetes Cluster with Terraform, Ansible, Cilium, Prometheus and Grafana

A fully automated cluster creation: Terraform creates a Debian VM in VMware Workstation, Ansible turns it into a Kubernetes node (kubeadm, containerd, Cilium), deploys a 3-pod demo application and installs a complete observability stack (Prometheus + Grafana + Hubble).

---

## Table of Contents

- [1. Why This Stack?](#why-this-stack)
- [2. Prerequisites](#prerequisites)
- [3. Part 1: Terraform, Creating the VM](#part-1-terraform-creating-the-vm)
- [4. Part 2: Ansible, Building the Cluster](#part-2-ansible-building-the-cluster)
- [5. Part 3: Observability](#part-3-observability)
- [6. Part 4: Verification and Tests](#part-4-verification-and-tests)

---

## Why This Stack?

| Tool                     | Role                                            | Why                                                                                               |
| ------------------------ | ----------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| **Terraform**            | Creates the virtual machine                     | Infrastructure as code: the VM can be destroyed and rebuilt with a single command.                |
| **Ansible**              | Configures the VM and installs everything on it | Agentless (just SSH), idempotent (safe to re-run), and every step is readable YAML.               |
| **kubeadm**              | Bootstraps Kubernetes                           | The official way to create a cluster, which is the best way to learn how Kubernetes really works. |
| **containerd**           | Container runtime                               | The standard runtime for Kubernetes                                                               |
| **Cilium**               | Networking (CNI)                                | eBPF-based networking with built-in observability (Hubble).                                       |
| **Prometheus + Grafana** | Metrics and dashboards                          | The de facto standard for monitoring Kubernetes. Installed as one package                         |

**Why WSL?** The two tools run on different sides of the Windows boundary:

- **Terraform runs on Windows**, because it drives VMware Workstation through `vmrun.exe`, a Windows program.
- **Ansible does not run on Windows** (it requires a Linux/Unix control node). **WSL2** gives us a real Linux environment on the same machine, and from there Ansible reaches the VM over SSH.

---

## Prerequisites

### On the Windows host

- **VMware Workstation Pro** (free for personal use). `vmrun.exe` is included.
- **Terraform** 1.4 or newer: `winget install Hashicorp.Terraform`
- **WSL2** with an Ubuntu (or Debian) distribution: `wsl --install -d Ubuntu-24.04`
- Resources for the VM: **4 vCPU and 8 GB RAM** (the monitoring stack needs it) and about 40 GB of disk.

### In WSL (Ubuntu)

```bash
sudo apt update && sudo apt install -y python3-pip pipx sshpass
pipx install --include-deps ansible
pipx ensurepath
cd ansible
ansible-galaxy collection install -r requirements.yml
```

> **Tip:** WSL marks everything under `/mnt/c` as world-writable, and Ansible refuses to read `ansible.cfg` from such a folder. Either keep the project inside the WSL filesystem (for example `~/k8s-node`), or point Ansible to the file explicitly:
> `export ANSIBLE_CONFIG="$PWD/ansible.cfg"`

### SSH key

Ansible logs in to the VM with an SSH key, which avoids passwords in files:

```bash
ssh-keygen -t ed25519
ssh-copy-id YOUR_USER@<vm_ip>  # after creating the virtual machine
```

### The Debian template VM

Terraform clones an existing, powered-off Debian VM. Build it once by hand in VMware Workstation:

1. Create a new VM from the **Debian 12** ISO named `debian12-template`. Use 2 vCPU, 4 GB RAM, a 40 GB disk and a **NAT** network adapter.
2. During installation select _standard system utilities_ and _SSH server_ (no desktop), and create your user.
3. Inside the template, as root:

```bash
apt update && apt install -y sudo openssh-server open-vm-tools curl
usermod -aG sudo YOUR_USER
echo 'YOUR_USER ALL=(ALL) NOPASSWD:ALL' > /etc/sudoers.d/YOUR_USER
systemctl enable --now ssh open-vm-tools

# Kubernetes does not support swap
swapoff -a && sed -i '/ swap / s/^/#/' /etc/fstab

# give every clone its own machine-id
truncate -s 0 /etc/machine-id
```

4. **Power the template off** (not suspend).

`open-vm-tools` matters: Terraform reads the VM's IP address through VMware Tools.

---

## Project Structure

```
single-node-cluster/
├── terraform/
│   ├── main.tf
│   ├── variables.tf
│   ├── outputs.tf
│   └── terraform.tfvars
│
└── ansible/
    ├── ansible.cfg
    ├── site.yml
    ├── requirements.yml
    ├── inventory/
    │   └── hosts.yml
    ├── group_vars/
    │   └── all.yml
    └── roles/
        ├── common/tasks/main.yml
        ├── containerd/tasks/main.yml
        ├── kubernetes/tasks/main.yml
        ├── helm/tasks/main.yml
        ├── cilium/
        │   ├── tasks/main.yml
        │   └── templates/cilium-values.yaml.j2
        ├── observability/
        │   ├── tasks/main.yml
        │   └── templates/kps-values.yaml.j2
        ├── cilium_metrics/tasks/main.yml
        ├── workloads/
        │   ├── tasks/main.yml
        │   └── templates/
        │       ├── demo-app.yaml.j2
        │       └── loadgen.yaml.j2
        └── metrics_check/tasks/main.yml
```

---

## Part 1: Terraform, Creating the VM

VMware Workstation has no mature Terraform provider, so we use Terraform's built-in `terraform_data` resource to run `vmrun.exe` (shipped with Workstation). The steps are: clone the template, set CPU and RAM, power on, and wait for the IP address.

### `variables.tf`

```hcl
variable "vm_name" {
  description = "Name of the VM (also the folder and .vmx file name)."
  type        = string
  default     = "k8s-node"
}

variable "vmrun_path" {
  description = "Full path to vmrun.exe on the Windows host."
  type        = string
  default     = "C:\\Program Files (x86)\\VMware\\VMware Workstation\\vmrun.exe"
}

variable "template_vmx" {
  description = "Full path to the powered-off Debian template .vmx to clone from."
  type        = string
  default     = "\\Path\\to\\debian12-template.vmx"
}

variable "vm_base_dir" {
  description = "Folder on the Windows host where the new VM directory is created."
  type        = string
  default     = "\\Path\\to\\created\\virtual\\machines"
}

variable "vcpus" {
  description = "Number of vCPUs."
  type        = number
  default     = 4
}

variable "memory_mb" {
  description = "Memory in megabytes"
  type        = number
  default     = 8192
}
```

Create `terraform.tfvars` and adjust the paths for your machine:

```hcl
vm_name      = "k8s-node"
vmrun_path   = "Path\\to\\vmrun.exe"
template_vmx = "Path\\to\\debian12-template.vmx"
vm_base_dir  = "\\Path\\to\\created\\virtual\\machines"
cpus         = 4
memory_mb    = 8192
```

### `main.tf`

```hcl
terraform {
  required_version = ">= 1.4.0"

  required_providers {
    local = {
      source  = "hashicorp/local"
      version = "~> 2.5"
    }
  }
}

locals {
  vm_dir  = "${var.vm_base_dir}\\${var.vm_name}"
  vmx     = "${local.vm_dir}\\${var.vm_name}.vmx"
  ip_file = "${path.module}\\vm_ip.txt"
}

resource "terraform_data" "k8s_node" {
  # Values needed by the destroy provisioner (it may only reference self).
  input = {
    vmrun = var.vmrun_path
    vmx   = local.vmx
    dir   = local.vm_dir
  }

  # Changing any of these recreates the VM.
  triggers_replace = [
    var.vm_name,
    var.template_vmx,
    var.cpus,
    var.memory_mb,
  ]

  provisioner "local-exec" {
    interpreter = ["powershell.exe", "-NoProfile", "-NonInteractive", "-Command"]
    command     = <<-EOT
      $ErrorActionPreference = 'Stop'
      $vmrun = '${var.vmrun_path}'
      $vmx   = '${local.vmx}'
      $dir   = '${local.vm_dir}'

      function Run {
        & $vmrun -T ws @args
        if ($LASTEXITCODE -ne 0) { throw ('vmrun failed: ' + ($args -join ' ')) }
      }

      if (Test-Path $vmx) { throw ('VM already exists at ' + $vmx) }
      New-Item -ItemType Directory -Force -Path $dir | Out-Null

      # 1. Full clone of the (powered-off) template
      Run clone '${var.template_vmx}' $vmx full ('-cloneName=${var.vm_name}')

      # 2. Set display name, vCPU and RAM in the .vmx (VM is powered off)
      $q = [char]34
      $keys = 'displayName|numvcpus|memsize|cpuid\.coresPerSocket'
      $lines = @(Get-Content $vmx | Where-Object { $_ -notmatch ('^(' + $keys + ')\s*=') })
      $lines += ('displayName = ' + $q + '${var.vm_name}' + $q)
      $lines += ('numvcpus = ' + $q + '${var.cpus}' + $q)
      $lines += ('cpuid.coresPerSocket = ' + $q + '${var.cpus}' + $q)
      $lines += ('memsize = ' + $q + '${var.memory_mb}' + $q)
      Set-Content -Path $vmx -Value $lines -Encoding ASCII

      # 3. Power on headless and wait for VMware Tools to report the IP
      Run start $vmx nogui
      $ip = (& $vmrun -T ws getGuestIPAddress $vmx -wait)
      if ($LASTEXITCODE -ne 0 -or -not $ip) { throw 'Could not get guest IP (is open-vm-tools running in the template?)' }
      Set-Content -Path '${local.ip_file}' -Value $ip.Trim() -NoNewline
      Write-Host ('k8s-node is up at ' + $ip)
    EOT
  }

  provisioner "local-exec" {
    when        = destroy
    interpreter = ["powershell.exe", "-NoProfile", "-NonInteractive", "-Command"]
    command     = <<-EOT
      $vmrun = '${self.input.vmrun}'
      $vmx   = '${self.input.vmx}'
      $dir   = '${self.input.dir}'
      if (Test-Path $vmx) {
        & $vmrun -T ws stop $vmx hard
        & $vmrun -T ws deleteVM $vmx
      }
      if (Test-Path $dir) { Remove-Item -Recurse -Force $dir }
      exit 0
    EOT
  }
}

data "local_file" "vm_ip" {
  filename   = local.ip_file
  depends_on = [terraform_data.k8s_node]
}
```

### `outputs.tf`

```hcl
output "vm_name" {
  value = var.vm_name
}

output "vmx_path" {
  value = local.vmx
}

output "vm_ip" {
  description = "IP address reported by VMware Tools; use it in the Ansible inventory."
  value       = trimspace(data.local_file.vm_ip.content)
}
```

### How it works

- **`terraform_data` + `local-exec`** runs a PowerShell script when the resource is created. It calls `vmrun clone` (full clone of the template), edits the `.vmx` file to set the name, vCPU and RAM, starts the VM headless (`nogui`), and waits for VMware Tools to report the guest IP.
- **`triggers_replace`**: if the name, template, CPU or RAM variables change, Terraform recreates the VM. Be careful: this deletes the VM and everything in it.
- **The destroy provisioner** (`when = destroy`) stops the VM hard, deletes it and removes its folder, so `terraform destroy` leaves nothing behind.
- **`vm_ip`** is saved to a small file and read back as an output, which is what we copy into the Ansible inventory.

### Running it

From a Windows PowerShell terminal:

```powershell
cd terraform
terraform init
terraform plan
terraform apply
```

Check from WSL that SSH works (and install your key if needed):

```bash
ssh-copy-id YOUR_USER@<vm-ipaddress>
ssh YOUR_USER@<vm-ipaddress>
```

To remove the VM completely: `terraform destroy`.

---

## Part 2: Ansible, Building the Cluster

Ansible runs from WSL and connects to the VM over SSH.

### Inventory and variables

`inventory/hosts.yml` tells Ansible which machine to configure. Paste the `vm_ip` from Terraform here:

```yaml
all:
  children:
    k8s:
      hosts:
        k8s-node:
          ansible_host: vm-ipaddress
          ansible_user: YOUR_USER
```

`group_vars/all.yml` holds every setting in one place:

```yaml
---
# Kubernetes
k8s_minor_version: 'v1.34'
pod_cidr: '10.244.0.0/16'
service_cidr: '10.96.0.0/12'
k8s_user_home: '/home/{{ ansible_user }}'

# Helm
helm_version: 'v3.18.6'

# Cilium (leave version empty for latest chart)
cilium_chart_version: ''

# Observability (kube-prometheus-stack)
monitoring_namespace: monitoring
kps_chart_version: ''
grafana_admin_password: 'xxxxxx' # put your password
grafana_nodeport: 30300
prometheus_nodeport: 30090

# Demo workload
demo_namespace: demo
demo_replicas: 3
demo_image: 'traefik/whoami:v1.10.1' # shows the pod name, so you can see load balancing
demo_nodeport: 30080

# Traffic generator
loadgen_enabled: true
loadgen_namespace: loadgen
loadgen_image: 'curlimages/curl:latest'
loadgen_interval: '0.5' # seconds between requests

# Cilium / Hubble
hubble_ui_nodeport: 31235
cilium_enable_servicemonitor: false

# Where the kubeconfig is copied on the WSL side
local_kubeconfig: '{{ playbook_dir }}/../kubeconfig-k8s-node.yaml'
```

### The playbook: how the roles work together

`site.yml` is the entry point. It runs the roles in order, and each role builds on the previous one:

```yaml
---
- name: Prepare Debian, install Kubernetes and observability stack
  hosts: k8s
  roles:
    - { role: common, tags: [common] }
    - { role: containerd, tags: [containerd] }
    - { role: kubernetes, tags: [kubernetes] }
    - { role: helm, tags: [helm] }
    - { role: cilium, tags: [cilium] }
    - { role: observability, tags: [observability] }
    - { role: cilium_metrics, tags: [monitoring] }
    - { role: workloads, tags: [workloads] }
    - { role: metrics_check, tags: [verify] }
```

Every role has a **tag**, so you can run a single one, for example `--tags workloads`. The playbook is **idempotent**: running it again changes only what is missing.

| #   | Role             | What it does                                                                                                                                                                                                                   |
| --- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | `common`         | Sets the hostname, disables swap, loads the kernel modules `overlay` and `br_netfilter`, and sets the sysctl values Kubernetes requires (IP forwarding, bridge filtering).                                                     |
| 2   | `containerd`     | Installs `containerd.io` and switches it to the systemd cgroup driver, which matches kubelet.                                                                                                                                  |
| 3   | `kubernetes`     | Adds the Kubernetes apt repository, installs and holds `kubeadm`, `kubelet`, `kubectl`, runs `kubeadm init`, removes the control-plane taint so pods can run on this single node, and copies the kubeconfig to WSL.            |
| 4   | `helm`           | Installs Helm, used for Cilium and the monitoring stack.                                                                                                                                                                       |
| 5   | `cilium`         | Installs Cilium as the network plugin, with Hubble (network visibility) enabled. The node becomes `Ready`.                                                                                                                     |
| 6   | `observability`  | Installs `kube-prometheus-stack`: Prometheus, Grafana, Alertmanager, node-exporter and kube-state-metrics.                                                                                                                     |
| 7   | `cilium_metrics` | Upgrades Cilium a second time so it publishes metrics to Prometheus and its dashboards appear in Grafana. This must come after the previous role, because the Prometheus CRDs it needs only exist once the stack is installed. |
| 8   | `workloads`      | Deploys the demo app (3 pods) and a small traffic generator.                                                                                                                                                                   |
| 9   | `metrics_check`  | Queries the Prometheus API and prints a summary.                                                                                                                                                                               |

### Key details

**Kubernetes initialisation** (`roles/kubernetes/tasks/main.yml`):

```yaml
- name: Initialise the control plane (single node)
  ansible.builtin.command: >
    kubeadm init
    --pod-network-cidr={{ pod_cidr }}
    --service-cidr={{ service_cidr }}
    --node-name=k8s-node
    --apiserver-cert-extra-sans={{ ansible_host }}
  args:
    creates: /etc/kubernetes/admin.conf # makes the task idempotent

- name: Allow workloads on the control-plane node (single-node cluster)
  ansible.builtin.command: >
    kubectl --kubeconfig /etc/kubernetes/admin.conf
    taint nodes k8s-node node-role.kubernetes.io/control-plane:NoSchedule-
```

`creates:` makes Ansible skip the command when `admin.conf` already exists. Removing the taint is what turns the control-plane node into a node that also runs applications.

**Cilium** is configured by a Jinja2 template (`roles/cilium/templates/cilium-values.yaml.j2`) and installed by Helm:

```yaml
ipam:
  mode: kubernetes

operator:
  replicas: 1
  prometheus:
    enabled: true
    serviceMonitor:
      enabled: { { cilium_enable_servicemonitor | lower } }

hubble:
  enabled: true
  relay:
    enabled: true
  ui:
    enabled: true
    service:
      type: NodePort
      nodePort: { { hubble_ui_nodeport } }
  metrics:
    enabled: [dns, drop, tcp, flow, icmp, http]
```

The variable `cilium_enable_servicemonitor` is `false` the first time and `true` when the `cilium_metrics` role re-applies the same role.

**The demo application** (`roles/workloads/templates/demo-app.yaml.j2`): a Deployment with 3 replicas of `traefik/whoami`, a small web server that returns the name of the pod that answered. Requests are limited, probes check health, and containers run as a non-root user:

```yaml
spec:
  replicas: {{ demo_replicas }}
  ...
      containers:
        - name: whoami
          image: {{ demo_image }}
          args: ["--port=8080"]
          resources:
            requests: { cpu: 50m,  memory: 32Mi }
            limits:   { cpu: 200m, memory: 128Mi }
          readinessProbe: ...
          livenessProbe: ...
          securityContext:
            runAsNonRoot: true
            runAsUser: 65534
            allowPrivilegeEscalation: false
```

A `Service` of type `NodePort` exposes it on port 30080.

### Running it

From WSL, inside the `ansible` folder:

```bash
ansible k8s -m ping
ansible-playbook site.yml
```

Useful partial runs:

```bash
ansible-playbook site.yml --tags workloads            # redeploy only the demo app
ansible-playbook site.yml --tags verify               # only the checks
ansible-playbook site.yml --tags observability,monitoring
```

The whole run takes roughly 10 to 20 minutes, mostly downloading images.

---

## Part 3: Observability

### What it is for

A cluster is made of many moving parts. **Observability** answers three questions: _Is everything healthy? How much is being used? What happened before it broke?_

| Component                   | Role                                                                                                                          |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| **Prometheus**              | Collects metrics ("scrapes") from every component every few seconds and stores them as time series. You query it with PromQL. |
| **Grafana**                 | Draws those metrics as dashboards.                                                                                            |
| **node-exporter**           | Exposes VM metrics: CPU, memory, disk, network.                                                                               |
| **kube-state-metrics**      | Exposes the _state_ of Kubernetes objects: how many replicas, pod phases, restarts.                                           |
| **Alertmanager**            | Receives alerts that Prometheus fires and routes them.                                                                        |
| **Hubble** (part of Cilium) | Shows the real network traffic between pods, live.                                                                            |

All of them were installed by Ansible, and all of them are reachable from your Windows browser through the VM's IP:

| What             | URL                    | Login                     |
| ---------------- | ---------------------- | ------------------------- |
| Demo application | `http://<vm_ip>:30080` | none                      |
| Grafana          | `http://<vm_ip>:30300` | `admin` / grfana password |
| Prometheus       | `http://<vm_ip>:30090` | none                      |
| Hubble UI        | `http://<vm_ip>:31235` | none                      |

### The demo application

Open `http://<vm_ip>:30080` and refresh several times. The `Hostname` line changes between the three pod names, which shows the Service load-balancing across the replicas.

### Grafana dashboards

Log in to Grafana and open **Dashboards** in the left menu. Ready-made dashboards are installed:

| Where to look                                                                             | What you see                                  |
| ----------------------------------------------------------------------------------------- | --------------------------------------------- |
| _Dashboards > Kubernetes / Compute Resources / Namespace (Pods)_, choose namespace `demo` | CPU and memory of each of the 3 pods          |
| _Dashboards > Kubernetes / Compute Resources / Cluster_                                   | Overview of the whole cluster                 |
| _Dashboards > Node Exporter / Nodes_                                                      | CPU, memory, disk and network of the VM       |
| _Dashboards > Cilium_ folder                                                              | Cilium and Hubble metrics (flows, drops, DNS) |

### Prometheus

- **Status > Target health** (`/targets`) lists everything Prometheus scrapes. Every target should be **UP**.
- **Query** (`/query`) lets you run PromQL directly. A few examples:

```promql
# CPU used by each demo pod
sum(rate(container_cpu_usage_seconds_total{namespace="demo"}[2m])) by (pod)

# Memory used by each demo pod
container_memory_working_set_bytes{namespace="demo", container!=""}

# Number of available replicas of the demo app
kube_deployment_status_replicas_available{namespace="demo"}

# CPU usage of the whole VM, in percent
100 - avg(rate(node_cpu_seconds_total{mode="idle"}[2m])) * 100
```

### Hubble UI

Open the Hubble UI, choose the namespace `demo`, and you see the live connections from the load generator (namespace `loadgen`) to the three pods.

---

## Part 4: Verification and Tests

### 1. The cluster is healthy

On the VM (`ssh YOUR_USER@<vm_ip>`):

```bash
kubectl get nodes -o wide
kubectl get pods -A
```

**Expected:** the node `k8s-node` has status `Ready`, and all pods are `Running` (and fully ready, for example `1/1`).

### 2. Check system pods

```bash
kubectl -n demo get pods -o wide
```

**Expected:** three `demo-web-...` pods in `Running` state.

### 3. Prometheus collecting data

```bash
ansible-playbook site.yml --tags verify
```

You can also check by hand in the Prometheus UI: _Status > Target health_, all targets are **UP**.

### 4. Grafana shows the data

Log in to Grafana, open _Kubernetes / Compute Resources / Namespace (Pods)_ and select `demo`.

**Expected:** graphs with CPU and memory for the three `demo-web` pods.

### 5. Scaling is visible in the monitoring

```bash
kubectl -n demo scale deploy/demo-web --replicas=5
kubectl -n demo scale deploy/demo-web --replicas=3
```

**Expected:** within about a minute, the number of available replicas in Prometheus and the number of pods in Grafana follow the change.

### 6. Self-healing

```bash
kubectl -n demo delete pod <one-demo-web-pod>
kubectl -n demo get pods
```

**Expected:** Kubernetes immediately starts a replacement pod, so there are three pods again, and the dip is visible on the replicas graph.

### Cleaning up

```powershell
cd terraform
terraform destroy
```

---
