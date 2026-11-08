package com.tanmaysinghx.qubit.mail;

import com.tanmaysinghx.qubit.config.QubitProperties;
import jakarta.mail.internet.MimeMessage;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;

@Slf4j
@Service
public class MailService {

    private static final DateTimeFormatter IST = DateTimeFormatter.ofPattern("EEE, d MMM yyyy · h:mm a 'IST'")
            .withZone(ZoneId.of("Asia/Kolkata"));

    private final ObjectProvider<JavaMailSender> senderProvider;
    private final QubitProperties props;
    private final boolean enabled;

    public MailService(ObjectProvider<JavaMailSender> senderProvider, QubitProperties props,
                       @Value("${spring.mail.host:}") String host) {
        this.senderProvider = senderProvider;
        this.props = props;
        this.enabled = host != null && !host.isBlank();
        if (!enabled) {
            log.warn("MAIL_HOST is not configured. Emails will be written to the log instead of being sent.");
        }
    }

    public boolean isEnabled() { return enabled; }

    @Async
    public void sendVerification(String to, String name, String token) {
        String link = props.frontendUrl() + "/verify-email?token=" + token;
        String body = MailTemplates.layout(
                "Confirm your email",
                "Hi " + MailTemplates.esc(firstName(name)) + ",",
                "You're one step away from your Qubit account. Confirm this address so we can send your hall tickets "
                        + "and results to the right place. The link is valid for 24 hours.",
                "Confirm email", link,
                "If you didn't create a Qubit account, you can ignore this message.");
        send(to, "Confirm your email for Qubit", body, "Verification link: " + link);
    }

    @Async
    public void sendPasswordReset(String to, String name, String token) {
        String link = props.frontendUrl() + "/reset-password?token=" + token;
        String body = MailTemplates.layout(
                "Reset your password",
                "Hi " + MailTemplates.esc(firstName(name)) + ",",
                "Someone — hopefully you — asked to reset the password for your Qubit account. "
                        + "Use the button below to choose a new one. The link works once and expires in one hour.",
                "Choose a new password", link,
                "Didn't ask for this? Ignore this email; your password stays the same.");
        send(to, "Reset your Qubit password", body, "Reset link: " + link);
    }

    @Async
    public void sendWelcome(String to, String name) {
        String link = props.frontendUrl() + "/app";
        String body = MailTemplates.layout(
                "Welcome to Qubit",
                "Hi " + MailTemplates.esc(firstName(name)) + ",",
                "Your email is confirmed and your account is ready. Browse the assessments that are open for "
                        + "registration, pick a slot that suits you and download your hall ticket. On exam day, keep a "
                        + "stable connection and a single screen — the exam window is locked once you begin.",
                "Go to your dashboard", link,
                "Good luck with your preparation. — Team Qubit");
        send(to, "Welcome to Qubit", body, null);
    }

    @Async
    public void sendHallTicket(String to, String name, String examTitle, String hallTicketNo, Instant slotStart) {
        String link = props.frontendUrl() + "/app/registrations";
        String body = MailTemplates.layout(
                "Registration confirmed",
                "Hi " + MailTemplates.esc(firstName(name)) + ",",
                "You're registered for <strong>" + MailTemplates.esc(examTitle) + "</strong>.<br><br>"
                        + "Hall ticket no. <strong style=\"font-family:ui-monospace,Menlo,monospace;letter-spacing:1px\">"
                        + MailTemplates.esc(hallTicketNo) + "</strong><br>"
                        + "Slot: <strong>" + IST.format(slotStart) + "</strong><br><br>"
                        + "Download and print your hall ticket from your dashboard. You can begin the exam from the "
                        + "slot start time; the exam permits a single attempt only.",
                "View hall ticket", link,
                "Need a different slot? You can reschedule from the dashboard until your current slot begins.");
        send(to, "Hall ticket · " + examTitle, body, null);
    }

    @Async
    public void sendAttemptCancelled(String to, String name, String examTitle, String reason) {
        String link = props.frontendUrl() + "/app/registrations";
        String body = MailTemplates.layout(
                "Your attempt was cancelled",
                "Hi " + MailTemplates.esc(firstName(name)) + ",",
                "An invigilator cancelled your attempt at <strong>" + MailTemplates.esc(examTitle) + "</strong>.<br><br>"
                        + "Reason: " + MailTemplates.esc(reason) + "<br><br>"
                        + "If you think this was a mistake (a power cut, a dropped connection, a system pop-up), you can "
                        + "appeal from your registrations page. Explain what happened; an invigilator will review it "
                        + "and may allow you to take the exam again.",
                "Open registrations", link,
                "You can submit one appeal per attempt.");
        send(to, "Attempt cancelled · " + examTitle, body, null);
    }

    @Async
    public void sendAppealDecision(String to, String name, String examTitle, boolean approved, String note, Instant retakeUntil) {
        String link = props.frontendUrl() + "/app/registrations";
        String noteHtml = note == null || note.isBlank() ? "" : "<br><br>Note from the invigilator: " + MailTemplates.esc(note);
        String body = approved
                ? MailTemplates.layout(
                        "Appeal approved — you can retake the exam",
                        "Hi " + MailTemplates.esc(firstName(name)) + ",",
                        "Your appeal for <strong>" + MailTemplates.esc(examTitle) + "</strong> was approved. "
                                + "Your earlier attempt has been set aside and you get a fresh, full-length attempt.<br><br>"
                                + "Start it before <strong>" + IST.format(retakeUntil) + "</strong>." + noteHtml,
                        "Start the retake", link,
                        "The same rules apply: one window, full screen, no switching away.")
                : MailTemplates.layout(
                        "Appeal not approved",
                        "Hi " + MailTemplates.esc(firstName(name)) + ",",
                        "We reviewed your appeal for <strong>" + MailTemplates.esc(examTitle) + "</strong> and could not "
                                + "approve it. The cancellation stands." + noteHtml,
                        "View registrations", link,
                        "This decision is final for this attempt.");
        send(to, (approved ? "Appeal approved · " : "Appeal decision · ") + examTitle, body, null);
    }

    private void send(String to, String subject, String html, String devHint) {
        if (!enabled) {
            log.info("[mail disabled] to={} subject=\"{}\"{}", to, subject, devHint == null ? "" : " :: " + devHint);
            return;
        }
        try {
            JavaMailSender sender = senderProvider.getObject();
            MimeMessage message = sender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, false, StandardCharsets.UTF_8.name());
            helper.setFrom(props.mail().from());
            helper.setTo(to);
            helper.setSubject(subject);
            helper.setText(html, true);
            sender.send(message);
            log.info("Mail sent to={} subject=\"{}\"", to, subject);
        } catch (Exception e) {
            log.error("Failed to send mail to {}: {}{}", to, e.getMessage(), devHint == null ? "" : " :: " + devHint);
        }
    }

    private static String firstName(String full) {
        if (full == null || full.isBlank()) return "there";
        return full.trim().split("\\s+")[0];
    }
}
