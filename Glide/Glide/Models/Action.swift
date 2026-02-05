//
//  Action.swift
//  Glide
//
//  Created by Claude on 2/5/26.
//  Action model representing a follow-up action
//

import Foundation

/// Action model representing a follow-up action from notes
struct Action: Codable, Identifiable, Equatable {

    // MARK: - Properties

    let id: String
    let noteId: String
    let actionType: ActionType
    let status: ActionStatus
    let priority: ActionPriority
    var title: String
    var description: String?
    var scheduledDate: Date?
    var scheduledEndDate: Date?
    var location: String?
    var attendees: [String]
    var emailTo: String?
    var emailSubject: String?
    var emailBody: String?
    var externalId: String?
    var externalService: String?
    var externalUrl: String?
    let createdAt: Date
    var executedAt: Date?

    // MARK: - Coding Keys

    enum CodingKeys: String, CodingKey {
        case id
        case noteId = "note_id"
        case actionType = "action_type"
        case status
        case priority
        case title
        case description
        case scheduledDate = "scheduled_date"
        case scheduledEndDate = "scheduled_end_date"
        case location
        case attendees
        case emailTo = "email_to"
        case emailSubject = "email_subject"
        case emailBody = "email_body"
        case externalId = "external_id"
        case externalService = "external_service"
        case externalUrl = "external_url"
        case createdAt = "created_at"
        case executedAt = "executed_at"
    }

    // MARK: - Computed Properties

    var isPending: Bool {
        status == .pending || status == .created
    }

    var isCompleted: Bool {
        status == .executed
    }

    var isFailed: Bool {
        status == .failed || status == .cancelled
    }

    var hasExternalLink: Bool {
        externalUrl != nil
    }

    // MARK: - Initialization

    init(
        id: String = UUID().uuidString,
        noteId: String,
        actionType: ActionType,
        status: ActionStatus = .pending,
        priority: ActionPriority = .medium,
        title: String,
        description: String? = nil,
        scheduledDate: Date? = nil,
        scheduledEndDate: Date? = nil,
        location: String? = nil,
        attendees: [String] = [],
        emailTo: String? = nil,
        emailSubject: String? = nil,
        emailBody: String? = nil,
        externalId: String? = nil,
        externalService: String? = nil,
        externalUrl: String? = nil,
        createdAt: Date = Date(),
        executedAt: Date? = nil
    ) {
        self.id = id
        self.noteId = noteId
        self.actionType = actionType
        self.status = status
        self.priority = priority
        self.title = title
        self.description = description
        self.scheduledDate = scheduledDate
        self.scheduledEndDate = scheduledEndDate
        self.location = location
        self.attendees = attendees
        self.emailTo = emailTo
        self.emailSubject = emailSubject
        self.emailBody = emailBody
        self.externalId = externalId
        self.externalService = externalService
        self.externalUrl = externalUrl
        self.createdAt = createdAt
        self.executedAt = executedAt
    }

    // MARK: - Equatable

    static func == (lhs: Action, rhs: Action) -> Bool {
        lhs.id == rhs.id && lhs.updatedAt == rhs.updatedAt
    }

    /// Computed property for updated at (using executedAt or createdAt)
    var updatedAt: Date {
        executedAt ?? createdAt
    }
}

// MARK: - Mock Data for Testing

#if DEBUG
extension Action {
    static let mockCalendar = Action(
        id: "1",
        noteId: "note-1",
        actionType: .calendar,
        status: .pending,
        priority: .high,
        title: "Team Meeting",
        description: "Weekly sync with the team",
        scheduledDate: Date().addingTimeInterval(86400),
        scheduledEndDate: Date().addingTimeInterval(90000),
        location: "Conference Room A",
        attendees: ["john@example.com", "jane@example.com"]
    )

    static let mockEmail = Action(
        id: "2",
        noteId: "note-1",
        actionType: .email,
        status: .created,
        priority: .medium,
        title: "Follow up with client",
        description: "Send proposal to the client",
        emailTo: "client@example.com",
        emailSubject: "Proposal",
        emailBody: "Hi, please find attached..."
    )

    static let mockReminder = Action(
        id: "3",
        noteId: "note-2",
        actionType: .reminder,
        status: .executed,
        priority: .high,
        title: "Call mom",
        description: "Weekly check-in call",
        scheduledDate: Date().addingTimeInterval(-3600),
        executedAt: Date().addingTimeInterval(-60)
    )

    static let mockActions = [
        Action(id: "1", noteId: "note-1", actionType: .calendar, title: "Meeting", status: .pending, priority: .high),
        Action(id: "2", noteId: "note-1", actionType: .email, title: "Email Client", status: .created, priority: .medium),
        Action(id: "3", noteId: "note-2", actionType: .reminder, title: "Call Mom", status: .executed, priority: .high),
        Action(id: "4", noteId: "note-3", actionType: .nextStep, title: "Review PR", status: .pending, priority: .low)
    ]
}
#endif
