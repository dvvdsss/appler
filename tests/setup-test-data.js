#!/usr/bin/env node
/**
 * Setup Test Data for RAG System
 * Creates sample iOS/Swift development documents with embeddings
 */

import postgres from 'postgres';

// Sample iOS/Swift development documents
const sampleDocuments = [
  {
    content: `SwiftUI Navigation Best Practices

SwiftUI provides several navigation patterns for iOS apps. The NavigationView and NavigationStack are the primary components for implementing navigation hierarchies.

Key principles:
1. Use NavigationStack for iOS 16+ apps
2. NavigationView for backward compatibility
3. Implement proper navigation titles and toolbar items
4. Handle deep linking with NavigationPath
5. Use programmatic navigation with NavigationDestination

Example:
NavigationStack {
    List(items) { item in
        NavigationLink(destination: DetailView(item: item)) {
            Text(item.title)
        }
    }
    .navigationTitle("Items")
}`,
    metadata: { topic: 'SwiftUI', category: 'Navigation', difficulty: 'intermediate' }
  },
  {
    content: `iOS App Architecture Patterns

Modern iOS development supports several architectural patterns:

1. MVC (Model-View-Controller)
   - Traditional iOS pattern
   - Simple for small apps
   - Can lead to massive view controllers

2. MVVM (Model-View-ViewModel)
   - Better separation of concerns
   - Works well with SwiftUI and Combine
   - Easier testing

3. VIPER (View-Interactor-Presenter-Entity-Router)
   - Complex but highly modular
   - Good for large teams
   - Steep learning curve

4. Clean Architecture
   - Domain-driven design
   - Independent of frameworks
   - Highly testable

Choose based on team size, app complexity, and maintenance requirements.`,
    metadata: { topic: 'Architecture', category: 'Patterns', difficulty: 'advanced' }
  },
  {
    content: `Core Data Performance Optimization

Core Data is Apple's object graph and persistence framework. Here are key optimization strategies:

1. Fetch Request Optimization
   - Use predicates to limit results
   - Implement batch fetching
   - Use faulting efficiently

2. Memory Management
   - Use NSManagedObjectContext properly
   - Implement proper object lifecycle
   - Avoid retain cycles

3. Background Processing
   - Use background contexts for heavy operations
   - Implement proper context merging
   - Handle concurrency correctly

4. Data Model Design
   - Normalize data appropriately
   - Use relationships efficiently
   - Implement proper indexing

Example:
let request: NSFetchRequest<Entity> = Entity.fetchRequest()
request.predicate = NSPredicate(format: "active == YES")
request.fetchLimit = 50
request.sortDescriptors = [NSSortDescriptor(key: "date", ascending: false)]`,
    metadata: { topic: 'Core Data', category: 'Performance', difficulty: 'advanced' }
  },
  {
    content: `UIKit vs SwiftUI Comparison

Understanding when to use UIKit vs SwiftUI:

UIKit Advantages:
- Mature and stable framework
- Full control over UI customization
- Better performance for complex animations
- Extensive third-party library support
- Works with all iOS versions

SwiftUI Advantages:
- Declarative syntax
- Less boilerplate code
- Built-in state management
- Cross-platform compatibility
- Modern reactive programming

Migration Strategy:
1. Start with SwiftUI for new features
2. Use UIViewRepresentable for UIKit integration
3. Gradually migrate existing screens
4. Maintain UIKit for complex custom views

Best Practice: Use SwiftUI for new projects targeting iOS 14+, UIKit for legacy support or complex custom UI requirements.`,
    metadata: { topic: 'Frameworks', category: 'Comparison', difficulty: 'intermediate' }
  },
  {
    content: `Combine Framework Reactive Programming

Combine is Apple's reactive programming framework for Swift:

Core Concepts:
1. Publishers - emit values over time
2. Subscribers - receive and process values
3. Operators - transform and combine streams
4. Cancellables - manage subscription lifecycle

Common Publishers:
- Just: emits single value
- Future: async single value
- PassthroughSubject: manual value emission
- CurrentValueSubject: stateful value holder
- Timer: periodic value emission

Example Usage:
let publisher = URLSession.shared
    .dataTaskPublisher(for: url)
    .map(\.data)
    .decode(type: Model.self, decoder: JSONDecoder())
    .receive(on: DispatchQueue.main)
    .sink(
        receiveCompletion: { completion in
            // Handle completion
        },
        receiveValue: { model in
            // Update UI
        }
    )

Integration with SwiftUI through @Published and @StateObject makes reactive UI updates seamless.`,
    metadata: { topic: 'Combine', category: 'Reactive Programming', difficulty: 'advanced' }
  },
  {
    content: `iOS Memory Management and ARC

Automatic Reference Counting (ARC) manages memory in iOS apps:

Key Concepts:
1. Strong References - default, keeps object alive
2. Weak References - doesn't keep object alive, becomes nil when deallocated
3. Unowned References - doesn't keep object alive, crashes if accessed after deallocation

Common Memory Issues:
1. Retain Cycles - objects holding strong references to each other
2. Memory Leaks - objects not being deallocated
3. Dangling Pointers - accessing deallocated memory

Solutions:
- Use weak self in closures
- Break retain cycles with weak/unowned references
- Use Instruments to detect leaks
- Implement proper delegate patterns

Example:
class ViewController: UIViewController {
    var timer: Timer?
    
    override func viewDidLoad() {
        timer = Timer.scheduledTimer(withTimeInterval: 1.0, repeats: true) { [weak self] _ in
            self?.updateUI()
        }
    }
    
    deinit {
        timer?.invalidate()
    }
}`,
    metadata: { topic: 'Memory Management', category: 'ARC', difficulty: 'intermediate' }
  }
];

// Generate simple mock embeddings (in real implementation, these would come from an embedding service)
function generateMockEmbedding() {
  const embedding = [];
  for (let i = 0; i < 2560; i++) {
    embedding.push(Math.random() * 2 - 1); // Random values between -1 and 1
  }
  return embedding;
}

async function setupTestData() {
  console.log('🚀 Setting up test data for RAG system...');
  
  const sql = postgres({
    host: 'localhost',
    port: 5432,
    database: 'apple_rag_db',
    username: 'apple_rag_user',
    password: 'password',
    ssl: false
  });

  try {
    // Clear existing data
    console.log('🧹 Clearing existing data...');
    await sql`DELETE FROM chunks`;
    
    // Insert sample documents
    console.log('📝 Inserting sample documents...');
    
    for (let i = 0; i < sampleDocuments.length; i++) {
      const doc = sampleDocuments[i];
      const embedding = generateMockEmbedding();
      
      await sql`
        INSERT INTO chunks (content, url, embedding, metadata)
        VALUES (${doc.content}, '', ${JSON.stringify(embedding)}, ${JSON.stringify(doc.metadata)})
      `;
      
      console.log(`   ✅ Inserted document ${i + 1}: ${doc.metadata.topic}`);
    }
    
    // Verify data
    const count = await sql`SELECT COUNT(*) as count FROM chunks`;
    console.log(`\n📊 Test data setup complete!`);
    console.log(`   📄 Documents inserted: ${count[0].count}`);
    console.log(`   🎯 Topics covered: ${sampleDocuments.map(d => d.metadata.topic).join(', ')}`);
    
    // Test a simple query
    console.log('\n🔍 Testing database query...');
    const testResults = await sql`
      SELECT id, LEFT(content, 100) as preview, metadata
      FROM chunks
      LIMIT 3
    `;
    
    console.log('   📋 Sample results:');
    testResults.forEach((row, index) => {
      console.log(`   ${index + 1}. ${row.metadata.topic}: ${row.preview}...`);
    });
    
  } catch (error) {
    console.error('❌ Error setting up test data:', error);
    process.exit(1);
  } finally {
    await sql.end();
  }
  
  console.log('\n🎉 Test data setup completed successfully!');
  console.log('   You can now run real RAG queries against the database.');
}

setupTestData();
