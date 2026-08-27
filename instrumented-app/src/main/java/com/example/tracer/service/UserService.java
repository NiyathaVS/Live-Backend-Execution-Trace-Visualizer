package com.example.tracer.service;

import com.example.tracer.repository.UserRepository;
import org.springframework.stereotype.Service;

@Service
public class UserService {

    private final UserRepository userRepository;
    private final ValidationService validationService;
    private final ProfileEnrichmentService profileEnrichmentService;

    public UserService(UserRepository userRepository,
                       ValidationService validationService,
                       ProfileEnrichmentService profileEnrichmentService) {
        this.userRepository = userRepository;
        this.validationService = validationService;
        this.profileEnrichmentService = profileEnrichmentService;
    }

    public String getUser(Long id) {
        validationService.validateUser(id);

        String base = userRepository.findUserById(id);
        String enriched = applyPostLoadEnrichment(id, base);

        profileEnrichmentService.enrichProfile(id);

        return formatUserResponse(enriched);
    }

    private String applyPostLoadEnrichment(Long id, String baseProfile) {
        simulateServiceWork(12);
        if (baseProfile == null || baseProfile.isBlank()) {
            return "Unknown-User-" + id;
        }
        return baseProfile + " [verified]";
    }

    private String formatUserResponse(String profile) {
        simulateServiceWork(8);
        return profile.trim();
    }

    private void simulateServiceWork(long millis) {
        try {
            Thread.sleep(millis);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }
}
