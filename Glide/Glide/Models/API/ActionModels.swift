//
//  ActionModels.swift
//  Glide
//
//  Created by Claude on 2/5/26.
//  Aligned with backend: app/schemas/action_schemas.py
//

import Foundation
import SwiftUI

// MARK: - Action Type

enum ActionType: String, Codable, CaseIterable {
    case calendar
    case email
    case reminder
    case nextStep = "next_step"

    var displayName: String {
        switch self {
        case .calendar: return "Calendar"
        case .email: return "Email"
        case .reminder: return "Reminder"
        case .nextStep: return "Next Step"
        }
    }

    var icon: String {
        switch self {
        case .calendar: return "calendar"
        case .email: return "envelope"
        case .reminder: return "bell"
        case .nextStep: return "checklist"
        }
    }
}

// MARK: - Action Status

enum ActionStatus: String, Codable, CaseIterable {
    case pending
    case created
    case executed
    case failed
    case cancelled

    var displayName: String {
        switch self {
        case .pending: return "Pending"
        case .created: return "Created"
        case .executed: return "Executed"
        case .failed: return "Failed"
        case .cancelled: return "Cancelled"
        }
    }

    var icon: String {
        switch self {
        case .pending: return "clock"
        case .created: return "plus.circle"
        case .executed: return "checkmark.circle.fill"
        case .failed: return "xmark.circle.fill"
        case .cancelled: return "minus.circle"
        }
    }

    var color: Color {
        switch self {
        case .pending: return .orange
        case .created: return .blue
        case .executed: return .green
        case .failed: return .red
        case .cancelled: return .gray
        }
    }
}

// MARK: - Action Priority

enum ActionPriority: String, Codable, CaseIterable {
    case low
    case medium
    case high

    var displayName: String {
        switch self {
        case .low: return "Low"
        case .medium: return "Medium"
        case .high: return "High"
        }
    }

    var icon: String {
        switch self {
        case .low: return "exclamationmark"
        case .medium: return "exclamationmark.2"
        case .high: return "exclamationmark.3"
        }
    }

    var color: Color {
        switch self {
        case .low: return .green
        case .medium: return .orange
        case .high: return .red
        }
    }
}

// MARK: - Action Response

struct ActionResponse: Codable, Identifiable, Equatable {
    let id: UUID
    let noteId: UUID
    let actionType: ActionType
    let status: ActionStatus
    let priority: ActionPriority
    let title: String
    let description: String?
    let scheduledDate: Date?
    let scheduledEndDate: Date?
    let location: String?
    let attendees: [String]
    let emailTo: String?
    let emailSubject: String?
    let emailBody: String?
    let externalId: String?
    let externalService: String?
    let externalUrl: String?
    let createdAt: Date
    let executedAt: Date?

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

    // MARK: - Equatable

    static func == (lhs: ActionResponse, rhs: ActionResponse) -> Bool {
        lhs.id == rhs.id
    }
}

// MARK: - Action Create Requests

struct ActionCreateRequest: Codable {
    let actionType: ActionType
    let title: String
    let description: String?
    let priority: ActionPriority

    // MARK: - Coding Keys

    enum CodingKeys: String, CodingKey {
        case actionType = "action_type"
        case title
        case description
        case priority
    }
}

struct CalendarActionCreateRequest: Codable {
    let actionType: ActionType = .calendar
    let title: String
    let description: String?
    let priority: ActionPriority
    let scheduledDate: Date
    let scheduledEndDate: Date?
    let location: String?
    let attendees: [String]

    // MARK: - Coding Keys

    enum CodingKeys: String, CodingKey {
        case actionType = "action_type"
        case title
        case description
        case priority
        case scheduledDate = "scheduled_date"
        case scheduledEndDate = "scheduled_end_date"
        case location
        case attendees
    }

    init(
        title: String,
        description: String? = nil,
        priority: ActionPriority = .medium,
        scheduledDate: Date,
        scheduledEndDate: Date? = nil,
        location: String? = nil,
        attendees: [String] = []
    ) {
        self.actionType = .calendar
        self.title = title
        self.description = description
        self.priority = priority
        self.scheduledDate = scheduledDate
        self.scheduledEndDate = scheduledEndDate
        self.location = location
        self.attendees = attendees
    }
}

struct EmailActionCreateRequest: Codable {
    let actionType: ActionType = .email
    let title: String
    let description: String?
    let priority: ActionPriority
    let emailTo: String
    let emailSubject: String
    let emailBody: String

    // MARK: - Coding Keys

    enum CodingKeys: String, CodingKey {
        case actionType = "action_type"
        case title
        case description
        case priority
        case emailTo = "email_to"
        case emailSubject = "email_subject"
        case emailBody = "email_body"
    }

    init(
        title: String,
        description: String? = nil,
        priority: ActionPriority = .medium,
        emailTo: String,
        emailSubject: String,
        emailBody: String
    ) {
        self.actionType = .email
        self.title = title
        self.description = description
        self.priority = priority
        self.emailTo = emailTo
        self.emailSubject = emailSubject
        self.emailBody = emailBody
    }
}

struct ReminderActionCreateRequest: Codable {
    let actionType: ActionType = .reminder
    let title: String
    let description: String?
    let priority: ActionPriority
    let scheduledDate: Date

    // MARK: - Coding Keys

    enum CodingKeys: String, CodingKey {
        case actionType = "action_type"
        case title
        case description
        case priority
        case scheduledDate = "scheduled_date"
    }

    init(
        title: String,
        description: String? = nil,
        priority: ActionPriority = .medium,
        scheduledDate: Date
    ) {
        self.actionType = .reminder
        self.title = title
        self.description = description
        self.priority = priority
        self.scheduledDate = scheduledDate
    }
}

struct NextStepCreateRequest: Codable {
    let actionType: ActionType = .nextStep
    let title: String
    let description: String?
    let priority: ActionPriority

    // MARK: - Coding Keys

    enum CodingKeys: String, CodingKey {
        case actionType = "action_type"
        case title
        case description
        case priority
    }

    init(
        title: String,
        description: String? = nil,
        priority: ActionPriority = .medium
    ) {
        self.actionType = .nextStep
        self.title = title
        self.description = description
        self.priority = priority
    }
}

// MARK: - Action Update Request

struct ActionUpdateRequest: Codable {
    let title: String?
    let description: String?
    let status: ActionStatus?
    let priority: ActionPriority?
    let scheduledDate: Date?
    let scheduledEndDate: Date?

    // MARK: - Coding Keys

    enum CodingKeys: String, CodingKey {
        case title
        case description
        case status
        case priority
        case scheduledDate = "scheduled_date"
        case scheduledEndDate = "scheduled_end_date"
    }
}

// MARK: - Action Execute Request

struct ActionExecuteRequest: Codable {
    let service: String // "google" or "apple"
}

// MARK: - Action Execute Response

struct ActionExecuteResponse: Codable {
    let actionId: UUID
    let status: ActionStatus
    let externalId: String?
    let externalUrl: String?
    let message: String

    // MARK: - Coding Keys

    enum CodingKeys: String, CodingKey {
        case actionId = "action_id"
        case status
        case externalId = "external_id"
        case externalUrl = "external_url"
        case message
    }
}

// MARK: - Mock Data for Testing

#if DEBUG
extension ActionResponse {
    static let mockCalendar = ActionResponse(
        id: UUID(),
        noteId: UUID(),
        actionType: .calendar,
        status: .pending,
        priority: .high,
        title: "Team Meeting",
        description: "Weekly sync with the team",
        scheduledDate: Date().addingTimeInterval(86400),
        scheduledEndDate: Date().addingTimeInterval(90000),
        location: "Conference Room A",
        attendees: ["john@example.com", "jane@example.com"],
        emailTo: nil,
        emailSubject: nil,
        emailBody: nil,
        externalId: nil,
        externalService: nil,
        externalUrl: nil,
        createdAt: Date(),
        executedAt: nil
    )

    static let mockEmail = ActionResponse(
        id: UUID(),
        noteId: UUID(),
        actionType: .email,
        status: .created,
        priority: .medium,
        title: "Follow up with client",
        description: "Send proposal to the client",
        scheduledDate: nil,
        scheduledEndDate: nil,
        location: nil,
        attendees: [],
        emailTo: "client@example.com",
        emailSubject: "Proposal",
        emailBody: "Hi, please find attached...",
        externalId: nil,
        externalService: nil,
        externalUrl: nil,
        createdAt: Date(),
        executedAt: nil
    )

    static let mockReminder = ActionResponse(
        id: UUID(),
        noteId: UUID(),
        actionType: .reminder,
        status: .executed,
        priority: .high,
        title: "Call mom",
        description: "Weekly check-in call",
        scheduledDate: Date().addingTimeInterval(-3600),
        scheduledEndDate: nil,
        location: nil,
        attendees: [],
        emailTo: nil,
        emailSubject: nil,
        emailBody: nil,
        externalId: nil,
        externalService: nil,
        externalUrl: nil,
        createdAt: Date().addingTimeInterval(-7200),
        executedAt: Date().addingTimeInterval(-60)
    )
}
#endif
