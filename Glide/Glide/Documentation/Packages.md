# Glide - Swift Package Manager Dependencies

**Last Updated:** February 5, 2026
**Project:** Glide iOS/macOS App
**Swift Tools Version:** 5.9

This document lists all Swift Package Manager (SPM) dependencies used in the Glide project, their versions, and their purposes.

---

## Package Dependencies

### 1. GRDB.swift

- **Package URL:** `https://github.com/groue/GRDB.swift`
- **Version:** 6.0.0 and above
- **Platform Support:** iOS 15+, macOS 12+
- **Purpose:** SQLite database access and management

**Description:**
GRDB.swift provides a powerful SQLite toolkit for Swift. It offers:
- Raw SQL query execution
- Record-based database access
- Database observation and change notifications
- Migration support
- WAL mode for better concurrency

**Usage in Glide:**
- Local note storage with full-text search
- Folder hierarchy management
- Offline-first data synchronization
- User preferences caching

**Key Features Used:**
- `DatabasePool` for concurrent database access
- `TableRecord` and `Codable` protocols for type-safe queries
- `ValueObservation` for reactive UI updates
- FTS5 (Full-Text Search) for note content search

---

### 2. KeychainAccess

- **Package URL:** `https://github.com/kishikawakatsumi/KeychainAccess`
- **Version:** 4.0.0 and above
- **Platform Support:** iOS 15+, macOS 12+
- **Purpose:** Secure credential storage in iOS/macOS Keychain

**Description:**
KeychainAccess provides a simple Swift wrapper around iOS/macOS Keychain Services. It simplifies secure storage of sensitive data like:
- Authentication tokens (access tokens, refresh tokens)
- User credentials
- API keys
- Session identifiers

**Usage in Glide:**
- Storing JWT access and refresh tokens
- Secure session persistence across app launches
- User authentication state management
- Token refresh lifecycle management

**Key Features Used:**
- `set(key:value:)` for storing sensitive data
- `get(key:)` for retrieving stored credentials
- `delete(key:)` for clearing credentials on logout
- Automatic synchronization with iCloud Keychain (optional)

---

## Dependency Management

### Adding New Dependencies

When adding a new SPM dependency to the project:

1. **Update Package.swift:**
   ```swift
   dependencies: [
       // ... existing dependencies
       .package(url: "https://github.com/owner/repo", from: "1.0.0"),
   ]
   ```

2. **Add to Target Dependencies:**
   ```swift
   .target(
       name: "Glide",
       dependencies: [
           .product(name: "NewLibrary", package: "repo"),
       ]
   )
   ```

3. **Update This Document:**
   - Add entry with package URL, version, purpose
   - Document usage in Glide
   - Note any configuration requirements

4. **Run Tests:**
   ```bash
   swift build
   swift test
   ```

### Version Pinning

- We use **minimum version constraints** (`from: X.Y.Z`) rather than exact versions
- This allows bug fixes and minor updates while maintaining API compatibility
- Major version bumps require manual review and testing

### Removing Dependencies

To remove a dependency:

1. Remove from `Package.swift` dependencies array
2. Remove from target's dependencies array
3. Remove all `import PackageName` statements from code
4. Update this document
5. Run clean build: `swift build --clean`

---

## Platform Compatibility

### iOS

- **Minimum Deployment Target:** iOS 15.0
- **Tested on:** iOS 15, iOS 16, iOS 17
- **Architecture:** arm64 (device), arm64 + x86_64 (simulator)

### macOS

- **Minimum Deployment Target:** macOS 12.0 (Monterey)
- **Tested on:** macOS 12, macOS 13, macOS 14
- **Architecture:** arm64 (Apple Silicon), x86_64 (Intel)

---

## Build Configuration

### Debug Builds

```bash
swift build
```

- Uses debug symbols
- No optimization
- Faster compilation
- Larger binary size

### Release Builds

```bash
swift build -c release
```

- Optimized for performance
- Smaller binary size
- Slower compilation
- Used for App Store submissions

### Clean Build

```bash
swift build --clean
swift build
```

Use clean builds when:
- After modifying Package.swift
- After switching branches
- When experiencing build cache issues
- Before release testing

---

## Troubleshooting

### Package Resolution Issues

**Problem:** Packages fail to resolve

**Solution:**
```bash
swift package reset
swift build
```

### Build Errors After Dependency Update

**Problem:** Code no longer compiles after dependency update

**Solution:**
1. Check package's changelog for breaking changes
2. Update imports and API calls
3. Consider pinning to previous version if necessary
4. File issue if breaking change wasn't documented

### Slow Package Downloads

**Problem:** Initial clone of dependencies is slow

**Solution:**
- Ensure stable internet connection
- Check GitHub status for outages
- Use shallow clones (handled automatically by SPM)
- Consider using a dependency mirror in restricted regions

---

## Security Considerations

### Dependency Auditing

Regularly audit dependencies for:
- Security vulnerabilities (CVEs)
- Abandoned or unmaintained packages
- Excessive permissions
- Large binary size impact

### Updating Dependencies

**Monthly Review:**
1. Check for security updates
2. Review changelogs for breaking changes
3. Test in staging environment
4. Update Package.swift with new versions

**Automated Alerts:**
- Enable GitHub Dependabot (if applicable)
- Monitor Swift package security advisories
- Subscribe to package release notifications

---

## Future Dependencies

### Under Evaluation

The following packages are being considered for future inclusion:

1. **Alamofire** - HTTP networking (if URLSession proves insufficient)
2. **SwiftUI-Introspect** - Access to UIKit/AppKit underlying views
3. **AsyncImage** - Improved async image loading
4. **Lottie** - Complex animations (if motion design requires it)

### Rejected Dependencies

The following packages were evaluated but not included:

1. **Realm** - Database (GRDB chosen for lighter weight)
2. **CoreData** - Database (Prefer pure Swift over Apple frameworks)
3. **Kingfisher** - Image loading (AsyncImage sufficient for current needs)

---

## Contact & Support

For questions about dependencies:
- Review package documentation (links above)
- Check project's `.claude/` directory for architecture decisions
- Consult backend API reference in `API_REFERENCE.md`

---

**Document Version:** 1.0.0
**Last Reviewed:** February 5, 2026
**Next Review Date:** March 5, 2026
