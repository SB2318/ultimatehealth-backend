# Understanding Docker

Docker solves the famous "it works on my machine" problem. It allows you to wrap an application's code, runtime, system tools, and libraries into a lightweight, isolated image.

- **Dockerfile:** A text blueprint containing instructions on how to build your application environment.
- **Docker Image:** The read-only, executable snapshot built from the Dockerfile.
- **Docker Container:** The live, running instance of that image isolated from the host operating system. 

## How They Work Together

In a typical modern development pipeline, the two tools work hand-in-hand rather than competing against each other:

- A developer writes code and uses **Docker** to build a container image.
- The image is uploaded to a centralized storage bank like **Docker Hub**.
- **Kubernetes** pulls that image from the registry and deploys it onto a production server cluster, handling all future traffic spikes and system crashes seamlessly.

# Usecase

During sudden traffic surges—such as millions of users logging in simultaneously—the application can generate a large number of events within a very short period.

# Scaling Startegy

We have to think in a way, how can we solve with minimal changes. So, My prefer strategies always will be with some configuration setup.

Here we are going to manage the **docker-compose** file with some minimal changes, so that we can fix at max.

#### 1. First of all, try to estimate your traffic.
#### 2. Increase partitionCount and brokerCount based on your estimation.

> A single broker can handle 2000-4000 partitions and 10000 client connections concurrently at any given point of time.
> So, in that case, you just have to add one more broker to your compose file.

#### 3. Set a max_connection_limit to your broker configuration.
> But, If  1,000,000 users open the app on their phones, and try connect directly to Kafka as 1,000,000 consumers. That would instantly crash the brokers.

#### 4. Don't use frontend.

> For high-traffic systems, Kafka should remain an internal backend infrastructure component, while frontend applications communicate through well-defined HTTP endpoints.

#### 5. Increase open-file descriptor limit (ulimit -n)

> If your operating system limit (ulimit -n) is set to 1024, your broker will crash once it tries to handle more than a few hundred clients and partitions. In production environments, administrators scale this OS limit up to 65535 or higher.

#### 6.  Group multiple backend instances of your application together using a shared group.id.

### Rule 1: One partition can only be read by ONE consumer instance in a group at a time.
### Rule 2: To scale a topic's processing, add more instances to the Consumer Group.


# Overall Flow

Estimate Traffic
↓
Increase Partitions Based on Required Parallelism
↓
Add Kafka Brokers When Broker Capacity Becomes a Bottleneck
↓
Protect Brokers with Connection Limits
↓
Keep Kafka Behind the Backend
↓
Increase ulimit -n for High Connection/File-Descriptor Requirements
↓
Add Consumer Instances to the Consumer Group
↓
Monitor and Load-Test the System


### Example Docker Compose:

(See our docker-compose, will update soon).
